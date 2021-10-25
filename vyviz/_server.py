import os, json, copy, threading, time
import subprocess
from pathlib import Path
from vytools.config import CONFIG, ITEMS
import vytools.utils as utils
import vytools.object
import vytools.episode
from vytools._actions import scan
import vytools.utils as utils
import logging
import asyncio
import hashlib

from sanic import Sanic, response
from sanic_cors import CORS, cross_origin

BASEPATH = os.path.dirname(os.path.realpath(__file__))

def hash_request(dictx):
  return hashlib.sha1(json.dumps(dictx, sort_keys=True).encode()).hexdigest()

def get_ui(req, items):
  ui_name = req.get('name','')
  ui = items.get(ui_name,None)
  loaded = {'html':'Could not find '+ui_name}
  if ui:
    loaded['name'] = ui_name
    loaded['html'] = Path(ui['path']).read_text()
  return loaded

def get_episode(episode_name, items):
  ep = items.get(episode_name,{})
  loaded = {}
  pth = 'Could not load "{}"'.format(episode_name)
  if episode_name.startswith('episode:') and ep:
    anchors = vytools.episode.get_anchors(ep)
    pth = 'Loaded episode "{n}" from definition at {p}'.format(n=episode_name,p=ep['path'])
    loaded = get_compose(ep.get('compose',''),items,anchors=anchors)
    loaded['name'] = episode_name
    eppath = vytools.episode.get_episode_path(episode_name,items=items)
    if eppath:
      try:
        with open(os.path.join(eppath,'vyanchors.json'),'r') as r:
          loaded['anchors'] = json.load(r)
          pth = 'Loaded episode "{n}" from results at {p}'.format(n=episode_name,p=eppath)
      except Exception as exc:
        logging.error('Failed to load anchors')
  return (loaded,pth)

def get_compose(compose_name,items,anchors=None):
  compose = items.get(compose_name,{})
  loaded = {}
  if compose:
    loaded['name'] = compose_name
    loaded['html'] = 'Could not find '+compose.get('ui','')
    if anchors:
      sc = vytools.compose.build(compose_name, items=items, anchors=anchors, build_level=-1)
      if sc:
        loaded['anchors'] = sc['anchors']
    uipth = vytools.utils.get_vd_path(compose.get('ui',''),items)
    if uipth: loaded['html'] = Path(uipth).read_text()
  return loaded

def build_run(req, action, jobpath, items):
  try:
    kwargs = req['kwargs'] if 'kwargs' in req else {}
    if kwargs is None: kwargs = {}
    if 'jobpath' in kwargs: del kwargs['jobpath']
    if jobpath: kwargs['jobpath'] = jobpath
    # kwargs['items'] = items # TODO Add this if you every make items a keyword
    if action == 'build':
      vytools.build(req['list'],items,**kwargs)
    elif action == 'run':
      vytools.run(req['list'],items,**kwargs)
  except Exception as exc:
    vytools.printer.print_fail(str(exc))
    
def mimetype(pth):
  extensions_map = {
      '': 'application/octet-stream',
      '.manifest': 'text/cache-manifest',
      '.html': 'text/html',
      '.png': 'image/png',
      '.ico': 'image/ico',
      '.jpg': 'image/jpg',
      '.svg':	'image/svg+xml',
      '.css':	'text/css',
      '.js':'application/x-javascript',
      '.wasm': 'application/wasm',
      '.json': 'application/json',
      '.xml': 'application/xml',
  }
  return extensions_map.get('.'+pth.rsplit('.',1)[-1],'text/html')

class StatusMsg:

  def __init__(self, queue):
    self.messages = {}
    self.queue = queue

  async def add(self,topic,msg,level='info',timeout=None):
    self.messages[topic] = {'message':msg,'level':level,'timeout':timeout,'start':time.time()}
    await self.queue.put(self.messages)

  async def check(self):
    t = time.time()
    changed = False
    n = len(self.messages.keys())
    self.messages = {k:m for k,m in self.messages.items() 
      if not (m['timeout'] and (t - m['start']) > m['timeout'])}
    if n != len(self.messages.keys()):
      await self.queue.put(self.messages)

  async def delete(self,topic):
    if topic in self.messages:
      del self.messages[topic]
      await self.queue.put(self.messages)

def server(vyitems=None, jobpath=None, port=17171, subscribers=None, 
    menu = None, sockets=None, top_level=None, hide_log=False, editable=False):
  rescannable = False
  IMAGES = {'images':{}}
  if vyitems is None: 
    rescannable = True
    IMAGES = vytools.info([], list_images=True)
    vyitems = ITEMS
  if subscribers is None: subscribers = {}
  if sockets is None: sockets = {}
  STATUSES = None
  THREAD = {}
  LOGSBUFFER = []

  vytools.printer.set_buffer(LOGSBUFFER)

  async def check_running():
    nonlocal THREAD, LOGSBUFFER
    while True:
      await asyncio.sleep(1)
      await STATUSES.check()
      try:
        deletes = [key for key in THREAD if not THREAD[key].is_alive()]
        for key in deletes:
            del THREAD[key]
            await STATUSES.add(key,'Finished job','info',4)
      except Exception as exc:
        print(exc)

  async def logsbuffer(logsque):
    nonlocal LOGSBUFFER
    while True:
      while LOGSBUFFER:
        await logsque.put({'message':LOGSBUFFER.pop().strip('\n')})
      await asyncio.sleep(0.1)

  # logging.basicConfig(level=logging.DEBUG)
  resources={r"/vy/*": {"origins": "*"}}
  for x in vyitems: # TODO can i get this to be rescannable?
    if x.startswith('vydir:'):
      vydir = x.split('/')[0].replace('vydir:','',1)
      resources[r"/{}/*".format(vydir)] = {"origins": "*"}
  app = Sanic(__name__)
  CORS(app, resources, automatic_options=True)

  @app.listener('after_server_start')
  async def create_task_queue(app, loop):
      nonlocal STATUSES
      app.statusqueue = asyncio.Queue(loop=loop, maxsize=100)
      app.logsqueue = asyncio.Queue(loop=loop, maxsize=100)
      asyncio.create_task(logsbuffer(app.logsqueue))
      asyncio.create_task(check_running())
      STATUSES = StatusMsg(app.statusqueue)

  app.static('/', os.path.join(BASEPATH, 'base', 'main.html'))
  app.static('/favicon.ico', os.path.join(BASEPATH, 'base', 'favicon.ico'))
  app.static('/vy/base', os.path.join(BASEPATH, 'base'))

  @app.route('<tag:path>', methods=['GET', 'OPTIONS'])
  async def _app_things(request, tag):
    pth = vytools.utils.get_vd_path('vydir:'+tag,vyitems)
    if pth:
      return await response.file(pth,headers={'Content-Type':mimetype(pth)})
    else:
      return response.empty()

  @app.post('/vy/subscribers/<tag>')
  async def _app_subscribers(request, tag):
    if tag in subscribers:
      return response.json(subscribers[tag](request.json) if tag in subscribers else {})
    return response.json({})

  for tag in sockets:
    app.add_websocket_route(sockets[tag], tag)

  @app.post('/vy/__<tag>__')
  async def _app_builtin(request, tag):
    nonlocal THREAD, IMAGES
    if tag == 'init':
      if request.json.get('rescan',False):
        if not rescannable:
          await STATUSES.add('rescan','Cannot rescan server','danger',timeout=5)
          return response.json({'success':False})
        await STATUSES.add('rescan','Rescanning...','info',timeout=5)
        await asyncio.sleep(1)
        scan(contextpaths=CONFIG.get('scanned'))
        IMAGES = vytools.info([], list_images=True)
        await STATUSES.add('delete','Rescanned','success',timeout=5)
      merged_items = {k:v for k,v in vyitems.items()}
      merged_items.update({k:v for k,v in IMAGES['images'].items()})
      rslt = {
        'items':merged_items,
        'server_subscribers':[k for k in subscribers.keys()],
        'menu':CONFIG.get('menu') if menu is None else menu,
        'hide_log':bool(hide_log),
        'success':True
      }
      if top_level is not None and top_level in vyitems: rslt['top_level'] = top_level
      return response.json(rslt)
    elif tag == 'login':
      username = request.json.get('username')
      password = request.json.get('password')
      return response.json('User accounts are not yet enabled')
    elif tag == 'delete':
      if editable:
        name = request.json.get('name',None)
        if name.startswith('image:'):
          try:
            r0 = subprocess.check_output(['docker','rmi',name.replace('image:','')]).decode('utf-8')
            r1 = subprocess.check_output(['docker','builder','prune','-f']).decode('utf-8')
            await app.logsqueue.put({'message':r0+r1})
            await STATUSES.add('delete','Successfully deleted '+name,'success',timeout=5)
            return response.json({'success':True})
          except Exception as exc:
            await STATUSES.add('delete','Failed to delete '+name,'danger',timeout=5)
            await app.logsqueue.put({'message':'{}'.format(exc)})
      else:
        await STATUSES.add('delete','Server is not editable','warning',timeout=5)
      return response.json({'success':False})
    elif tag == 'stop':
      vytools.composerun.stop()
    elif tag == 'compose':
      return response.json(get_compose(request.json.get('name',''), vyitems))
    elif tag == 'episode':
      ep,pth = get_episode(request.json.get('name',''), vyitems)
      await STATUSES.add('episode',pth,timeout=5)
      return response.json(ep)
    elif tag == 'item':
      pth = vyitems.get(request.json.get('name',None),{}).get('path',None)
      if pth: return await response.file(pth)
    elif tag in ['build','run']:
      starting = False
      key = 'job_'+hash_request(request.json)
      if key not in THREAD or not THREAD[key].is_alive():
        await STATUSES.add(key,'Started job, no more jobs will be accepted until this one finishes','info')
        THREAD[key] = threading.Thread(target=build_run, args=(request.json, tag, jobpath, vyitems,), daemon=True)
        THREAD[key].start()
        starting = bool(THREAD[key])
      else:
        await STATUSES.add(key,'Wait until current job finishes','info')
      return response.json({'starting':starting})
    elif tag == 'menu':
      if menu is None: CONFIG.set('menu',request.json)
    elif tag == 'artifact':
      episode_name = request.json.get('name','')
      if episode_name.startswith('episode:'):
        artifact_name = request.json.get('artifact','_')
        apaths = vytools.episode.artifact_paths(episode_name, vyitems, jobpath=jobpath)
        if artifact_name in apaths:
          return await response.file(apaths[artifact_name])
        else:
          logging.error('Could not find artifact {n} in {l}'.format(n=artifact_name,l=','.join(apaths)))
    return response.json({})

  @app.websocket('/vy/server_status')
  async def _app_server_status(request, ws):
    while True:
      msg = await app.statusqueue.get()
      await ws.send(json.dumps(msg))

  @app.websocket('/vy/logging')
  async def _app_logs(request, ws):
    while True:
      msg = await app.logsqueue.get()
      await ws.send(json.dumps(msg))

  try:
    app.run(host="0.0.0.0", port=port, debug=False, access_log=False)
    logging.info('Serving vytools on http://localhost:{p}'.format(p=port))
  except KeyboardInterrupt:
    # TODO shutdown running jobs?
    vytools.composerun.stop()
    print("Received exit, exiting.")
  