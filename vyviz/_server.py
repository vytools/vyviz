import os, json, threading, time
import subprocess
from pathlib import Path
from vytools.config import CONFIG, ITEMS
import vytools.episode
from vytools._actions import scan
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

def get_episode(episode_name, items, jobpath=None):
  ep = items.get(episode_name,{})
  loaded = {}
  msg = 'Could not load "{}"'.format(episode_name)
  if episode_name.startswith('episode:') and ep:
    anchors = vytools.episode.get_anchors(ep)
    msg = 'Loaded episode "{n}" from definition at {p}'.format(n=episode_name,p=ep['path'])
    loaded = get_compose(ep.get('compose',''),items,anchors=anchors)
    loaded['name'] = episode_name
    eppath = vytools.episode.get_episode_path(episode_name,items=items,jobpath=jobpath)
    if eppath:
      try:
        with open(os.path.join(eppath,'vyanchors.json'),'r') as r:
          loaded['anchors'] = json.load(r)
          msg = 'Loaded episode "{n}" from results at {p}'.format(n=episode_name,p=eppath)
      except Exception as exc:
        logging.error('Failed to load anchors {}'.format(exc))
  return (loaded,msg)

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
    uipth = vytools.utils.get_thing_path(compose.get('ui',''),items)
    if uipth: loaded['html'] = Path(uipth).read_text()
  return loaded

def build_run(req, action, jobpath, items):
  try:
    kwargs = req['kwargs'] if 'kwargs' in req else {}
    if kwargs is None: kwargs = {}
    if 'jobpath' in kwargs: del kwargs['jobpath']
    if jobpath: kwargs['jobpath'] = jobpath
    # kwargs['items'] = items # TODO Add this if you ever make items a keyword
    if action == '__build__':
      vytools.build(req['list'],items,**kwargs)
    elif action == '__run__':
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
  STATUSQUEUE = None
  LOGSQUEUE = None

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
      resources[r"/{}/*".format(vydir)] = {"origins": "*", "methods": ["GET", "OPTIONS"]}
  app = Sanic("vyviz")
  CORS(app, resources, automatic_options=True)

  @app.listener('after_server_start')
  async def create_task_queue(app, loop):
      nonlocal STATUSES, STATUSQUEUE, LOGSQUEUE
      STATUSQUEUE = asyncio.Queue(loop=loop, maxsize=100)
      LOGSQUEUE = asyncio.Queue(loop=loop, maxsize=100)
      asyncio.create_task(logsbuffer(LOGSQUEUE))
      asyncio.create_task(check_running())
      STATUSES = StatusMsg(STATUSQUEUE)

  app.static('/', os.path.join(BASEPATH, 'base', 'main.html'))
  app.static('/favicon.ico', os.path.join(BASEPATH, 'base', 'favicon.ico'))
  app.static('/vy/base', os.path.join(BASEPATH, 'base'))

  @app.route('/vy/subscribers/<tag>', methods=['POST', 'OPTIONS'])
  async def _app_subscribers(request, tag):
    if tag in subscribers:
      return response.json(subscribers[tag](request.json) if tag in subscribers else {})
    return response.json({})

  @app.route('<tag:path>', methods=['GET', 'OPTIONS'])
  async def _app_things(request, tag):
    if tag.startswith('/vy/'):
      return response.empty()
    pth = vytools.utils.get_thing_path('vydir:'+tag,vyitems)
    if pth:
      return await response.file(pth,headers={'Content-Type':mimetype(pth)})
    else:
      return response.empty()

  @app.post('/vy/action/<tag>')
  async def _app_builtin(request, tag):
    nonlocal THREAD, IMAGES, LOGSQUEUE
    if tag == '__init__':
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
      merged_items.update({k:v for k,v in IMAGES.get('images',{}).items()})
      # meta_content = {k:{'path':v['path']} for k,v in ITEMS}
      rslt = {
        'itmscontent':merged_items,
        'server_subscribers':[k for k in subscribers.keys()],
        'menu':CONFIG.get('menu') if menu is None else menu,
        'hide_log':bool(hide_log),
        'success':True
      }
      if top_level is not None and top_level in vyitems: rslt['top_level'] = top_level
      return response.json(rslt)
    elif tag == '__login__':
      username = request.json.get('username')
      password = request.json.get('password')
      return response.json('User accounts are not yet enabled')
    elif tag == '__save__':
      if editable:
        name = request.json.get('name',None)
        value = request.json.get('value',None)
        if name and name in vyitems and 'path' in vyitems[name] and value and any([name.startswith(t+':') for t in ['definition','object','stage','compose','episode']]):
          try:
            Path(vyitems[name]['path']).write_text(value)
            await STATUSES.add('saved','Successfully saved '+name,'success',timeout=2)
            return response.json({'success':True})
          except:
            pass
      await STATUSES.add('saved','Failed to save '+name,'danger',timeout=2)
      return response.json({'success':False})
    elif tag == '__delete__':
      if editable:
        name = request.json.get('name',None)
        if name.startswith('image:'):
          try:
            r0 = subprocess.check_output(['docker','rmi',name.replace('image:','')]).decode('utf-8')
            r1 = subprocess.check_output(['docker','builder','prune','-f']).decode('utf-8')
            await LOGSQUEUE.put({'message':r0+r1})
            await STATUSES.add('delete','Successfully deleted '+name,'success',timeout=5)
            return response.json({'success':True})
          except Exception as exc:
            await STATUSES.add('delete','Failed to delete '+name,'danger',timeout=5)
            await LOGSQUEUE.put({'message':'{}'.format(exc)})
      else:
        await STATUSES.add('delete','Server is not editable','warning',timeout=5)
      return response.json({'success':False})
    elif tag == '__stop__':
      vytools.composerun.stop()
    elif tag == '__compose__':
      return response.json(get_compose(request.json.get('name',''), vyitems))
    elif tag == '__episode__':
      ep,pth = get_episode(request.json.get('name',''), vyitems, jobpath=jobpath)
      await STATUSES.add('episode',pth,timeout=5)
      return response.json(ep)
    elif tag == '__item__':
      pth = vyitems.get(request.json.get('name',None),{}).get('path',None)
      if pth: return await response.file(pth)
    elif tag in ['__build__','__run__']:
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
    elif tag == '__menu__':
      if menu is None: CONFIG.set('menu',request.json)
    elif tag == '__artifact__':
      episode_name = request.json.get('name','')
      if episode_name.startswith('episode:'):
        artifact_name = request.json.get('artifact','_')
        apaths = vytools.episode.artifact_paths(episode_name, vyitems, jobpath=jobpath)
        if artifact_name in apaths:
          return await response.file(apaths[artifact_name])
        else:
          logging.error('Could not find artifact {n} in {l}'.format(n=artifact_name,l=','.join(apaths)))
    return response.json({})

  for tag in sockets:
    app.add_websocket_route(sockets[tag], tag)

  @app.websocket('/vy/server_status')
  async def _app_server_status(request, ws):
    nonlocal STATUSQUEUE
    while True:
      msg = await STATUSQUEUE.get()
      await ws.send(json.dumps(msg))

  @app.websocket('/vy/logging')
  async def _app_logs(request, ws):
    nonlocal LOGSQUEUE
    while True:
      msg = await LOGSQUEUE.get()
      await ws.send(json.dumps(msg))

  try:
    app.run(host="0.0.0.0", port=port, debug=False, access_log=False)
    logging.info('Serving vytools on http://localhost:{p}'.format(p=port))
  except KeyboardInterrupt:
    # TODO shutdown running jobs?
    vytools.composerun.stop()
    print("Received exit, exiting.")
  
