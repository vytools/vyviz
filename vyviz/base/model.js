import { utilities } from './utilities.js';

export let MODEL = {
  config : {
    thingtypes:{
      repo:{bl:'Re',color:'yellow'},
      definition:{bl:'De',color:'red'},
      object:{bl:'Ob',color:'orange'},
      vydir:{bl:'Vd',color:'blue'},
      stage:{bl:'St',color:'purple'},
      compose:{bl:'Co',color:'green'},
      episode:{bl:'Ep',color:'black'},
      image:{bl:'Im',color:'pink'}
    }  
  },
  items : {},
  ilist : [],
  top_level: null,
  hide_log: false,
  selected : {},
  menu : [],
  clear_selected: function() {
    MODEL.selected.name = null;
    MODEL.selected.loaded = null;
    let iframe = document.querySelector('iframe')
    if (iframe) iframe.setAttribute('srcdoc','');  
  },
  init : function(rescan, cb) {
    utilities.serverfetch('/vy/__init__',{rescan:rescan},function(r) {
      if (!r || !r.success) return;
      MODEL.top_level = (r.top_level) ? r.top_level : null;
      MODEL.hide_log = Boolean(r.hide_log);
      MODEL.items = {};
      if (r.items) Object.keys(r.items).forEach(k => MODEL.items[k] = r.items[k]);
      if (r.menu) MODEL.menu = r.menu;
      MODEL.ilist = Object.keys(MODEL.items);
      if (cb) cb();
    });
  }  
};

const add_action_button = function(item, action) {
  let a = document.createElement('a');
  a.classList.add('btn');
  a.setAttribute('data-action',action.action);
  let typ = item.split(':')[0];
  if (action.hasOwnProperty('enabled') && action.enabled.indexOf(typ) == -1) {
    a.disabled = true;
    a.classList.add('disabled');
  }
  let span = document.createElement('span');
  let i = document.createElement('i');
  i.classList.add('fas',action.icon);
  span.appendChild(i);
  if (action.classes) action.classes.forEach(cl => span.classList.add(cl));
  a.appendChild(span);
  return a;
}

const create_li = function(z) {
  let li = document.createElement('li');
  li.classList.add('list-group-item', 'ellips', z.class);
  li.setAttribute('data-item', z.name);
  li.setAttribute('title', z.name);
  
  let div = document.createElement('div');
  div.classList.add('btn-group', 'hide', 'action-item-group');
  z.actions.forEach( a => div.appendChild(add_action_button(z.name, a)));
  li.innerText = z.label;
  li.appendChild(div);

  if (z.name.startsWith('episode:')) {
    let divrh = document.createElement('div');
    divrh.classList.add('btn-group', 'reversehide', 'action-item-group');
    divrh.appendChild(add_action_button(z.name, {
      icon: (z.item.passed) ? 'fa-thumbs-up' : 'fa-thumbs-down',
      classes: [(z.item.passed) ? 'episodepassed' : 'episodefailed']
    }));
    li.appendChild(divrh);
  }

  return li;
}

export function create_menu_item(v,actions) {
  let item = MODEL.items[v];
  let cfg = MODEL.config.thingtypes[item.thingtype];
  let act = (actions) ? actions : [
    {'action':'graph','icon':'fa-bullseye'},
    {'action':'build','icon':'fa-hard-hat','enabled':['stage','compose','episode']},
    {'action':'run','icon':'fa-running','enabled':['episode']},
    {'action':'compose','icon':'fa-users-cog','enabled':['episode','compose']},
    {'action':'remove','icon':'fa-times-circle'},
    {'action':'delete','icon':'fa-trash'}
  ];
  return create_li({
    label:`${cfg.bl}:${item['name']}`,
    item:item,
    name:v,
    class:`color-${cfg.color}-4`,
    actions:act
  });
}

export function make_item_list(lst) {
  return lst.filter(v => MODEL.items.hasOwnProperty(v))
            .map(v => create_menu_item(v,null));
}

MODEL.clear_selected();

