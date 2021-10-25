import { MODEL } from './model.js';
import { utilities } from './utilities.js';
import './messages.js';
import './log.js';
import { MENU } from './menuitems.js';
import { type_buttons } from './typebuttons.js';
import { draw_graph, add_graphs } from './graph_model.js';

window.toggleclass = utilities.toggleclass;
window.addEventListener('message',function(e) {
  let iframe = document.querySelector('iframe');
  if (e.origin == 'null' && e.source === iframe.contentWindow) {
    utilities.serverfetch(e.data.topic, e.data.data, function(r) {
      iframe.contentWindow.postMessage({id:e.data.id,data:r},'*');
    });
  }
});

window.iframe_resize = function(ev) {
  let iframe = document.querySelector('iframe');
  if (ev.type == 'mousedown') {
    iframe.style.display = 'none';
  } else if (ev.type == 'mouseup') {
    iframe.style.display = 'inherit';
  }
}

window.iframe_loaded = function(self) {
  self.contentWindow.postMessage({id:'__initialize__',data:MODEL.selected.loaded},'*');
}

window.rescan = function() {
  init(true);
}

document.querySelector('form.login').addEventListener('submit', e => {
  let data = Object.fromEntries(new FormData(e.target).entries());
  e.preventDefault();
  utilities.serverfetch('/vy/__login__',data,r => {
    console.log('response',r)
  });
  return false;
});

document.querySelector('.usermenu').addEventListener('click',e => {
  let target = (e.target.classList.contains('.usermenu')) ? e.target : e.target.closest('.usermenu');
  utilities.removeclass('.sidebartabs div','active');
  if (target.classList.contains('btn-secondary')) {
    target.classList.remove('btn-secondary');
    utilities.addclass('.sidebartabs .thingsidebar','active');
  } else {
    target.classList.add('btn-secondary');
    utilities.addclass('.sidebartabs .usersidebar','active');
    let sidebar = document.querySelector('.sidebar');
    sidebar.style.flexGrow = Math.max(sidebar.style.flexGrow, 1);
  }
});

document.querySelector('.showmessages').addEventListener('click',e => {
  let target = (e.target.classList.contains('.showmessages')) ? e.target : e.target.closest('.showmessages');
  let sm = target.querySelector('i');
  let mm = document.querySelector('div.mymessages');
  if (sm.classList.contains('fa-bell-slash')) {
    sm.classList.remove('fa-bell-slash')
    mm.style.display = 'block';
    sm.classList.add('fa-bell');
    target.classList.add('btn-secondary');
  } else {
    sm.classList.remove('fa-bell');
    mm.style.display = 'none';
    sm.classList.add('fa-bell-slash')
    target.classList.remove('btn-secondary');
  }

})

window.add_item = function(self) { 
  add_to_menu(self.value);
  window.item_action(self.value,'graph')
}

window.add_to_menu = function (v) {
  if (MODEL.menu.indexOf(v) == -1) { 
    MODEL.menu.push(v);
    utilities.serverfetch('/vy/__menu__',MODEL.menu,null);
    MENU.update();
  }
}

const remove_from_menu = function (v) {
  let idx = MODEL.menu.indexOf(v);
  if (idx > -1) {
    MODEL.menu.splice(idx,1);
    utilities.serverfetch('/vy/__menu__',MODEL.menu,null);
    if (v == MODEL.selected.name) MODEL.clear_selected();
    MENU.update();
  }
}

const select_item = function(v) {
  if (!v) return;
  MENU.select(v);
  MODEL.selected.name = v;
}

const compose_view = function(v) {
  select_item(v);
  let iframe = document.querySelector('div.workspacetabs div.iframe iframe');
  utilities.removeclass('div.workspacetabs div','active');
  utilities.addclass('div.workspacetabs div.iframe','active');

  let split_name = v.split(':');
  let typ = `/vy/__${split_name[0]}__`;
  if (['/vy/__compose__', '/vy/__episode__'].indexOf(typ) > -1) {
    utilities.serverfetch(typ, {name:v},function(d) {
      MODEL.selected.loaded = d;
      let src = (d.hasOwnProperty('html')) ? d.html : '<p>not found</p>';
      iframe.setAttribute('srcdoc',src);
    });
  }
}

const build_run = function(cmd, list, kwargs) {
  // if (cmd == '/vy/__run__') compose_view(item);
  utilities.serverfetch(cmd,{list:list,kwargs:kwargs});
}

document.addEventListener('keyup',e => {
  if (MODEL.selected && MODEL.selected.name) {
    if (e.key == 'B') {
      build_run('/vy/__build__', [MODEL.selected.name], {"build_args":{}, "build_level":(e.ctrlKey) ? 1 : 0})
    } else if (e.key == "Enter" && e.shiftKey) {
      build_run('/vy/__run__', [MODEL.selected.name], {"build_args":{}, "clean":false})
    }
  }
})

const try_delete = function(name) {
  let item = MODEL.items[name];
  if (item.depended_on.length == 0) {
    let c = prompt(`Are you sure you want to PERMANENTLY delete "${name}". Type "yes" and click ok`);
    if (c == "yes") {
      utilities.serverfetch('/vy/__delete__',{name:name},(r) => {
        if (r.success) window.rescan();
      });
    }
  } else {
    window.set_message('delete','danger','Cannot delete item that is depended on by other items',4);
  }
}

window.item_action = function(item, action, kwargs) {
  if (!item) return
  if (action=='remove') {
    remove_from_menu(item);
  } else if (action=='add') {
    add_to_menu(item);
  } else if (action=='build') {
    if (!kwargs) kwargs = {"build_args":{}, "build_level":1};
    build_run('/vy/__build__', [item], kwargs);
  } else if (action=='run') {
    if (!kwargs) kwargs = {"build_args":{}, "clean":false};
    build_run('/vy/__run__', [item], kwargs);
  } else if (action=='delete') {
    try_delete(item);
  } else if (action=='compose') {
    compose_view(item);
  } else { //  default and (action=='graph')
    select_item(item);
    add_graphs();
    draw_graph();
  }
}

let CLICKTIMER = null;
document.querySelector('div.itemlist').onclick = function(event) {
  if (event.detail > 1) clearTimeout(CLICKTIMER);
  event.preventDefault();
  event.stopPropagation();
  var target = utilities.get_event_target(event);
  let item = utilities.get_data_until(target,'item','LI');
  let action = utilities.get_data_until(target,'action','LI');
  if ((action=='remove' || action=='delete') && event.detail <=1 ) return;
  if (event.detail==1 && action == 'build') {
    CLICKTIMER = setTimeout(() => {
      let skwargs = window.prompt("Build key word arguments",'{"build_args":{}, "build_level":1}');
      if (skwargs) item_action(item, action, JSON.parse(skwargs))
    }, 300);
  } else if (event.detail==1 && action == 'run') {
    CLICKTIMER = setTimeout(() => {
      let skwargs = window.prompt("Run key word arguments",'{"build_args":{}, "clean":false}');
      if (skwargs) item_action(item, action, JSON.parse(skwargs))
    }, 300);
  } else {
    item_action(item, action);
  }
}

const init = function(rescan) {
  MODEL.init(rescan, function() {
    if (MODEL.top_level) {
      item_action(MODEL.top_level,'compose');
      document.querySelector('.sidebar').style.flexGrow = 0
    }
    if (MODEL.hide_log) {
      document.querySelector('.logs').style.flexGrow = 0
    }
    type_buttons();
    MENU.init(MODEL.menu); // hook up menu
    MENU.update();
  });
}

window.onresize = function() { 
  draw_graph();
}

init(false);  // INITIALIZATION ============================
