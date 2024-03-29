import { MODEL } from './model.js';
import { utilities } from './utilities.js';
import './messages.js';
import './log.js';
import './actions.js';
import { MENU } from './menuitems.js';
import { type_buttons } from './typebuttons.js';
import { draw_graph, add_graphs } from './graph_model.js';

window.toggleclass = utilities.toggleclass;
window.addEventListener('message',function(e) {
  let iframe = document.querySelector('iframe');
  if (e.origin == 'null' && e.source === iframe.contentWindow && e.data.topic) {
    if (e.data.topic == '__sub_episode__') {
      compose_view(e.data.name, e.data.suffix);
    } else {
      utilities.serverfetch(e.data.topic, e.data.data, function(r) {
        iframe.contentWindow.postMessage({id:e.data.id,data:r},'*');
      });
    }
  }
});

let IFRAME = document.querySelector('iframe');
window.iframe_resize = function(ev) {
  if (ev.type == 'mousedown') {
    IFRAME.style.display = 'none';
  } else if (ev.type == 'mouseup') {
    IFRAME.style.display = 'inherit';
  }
}

document.querySelector('body').addEventListener('mouseup',ev => {
  // iframe_resize not triggered when you mouse up and the window wasn't very recently resized, need this
  IFRAME.style.display = 'inherit';
});

window.iframe_loaded = function(self) {
  self.contentWindow.postMessage({id:'__initialize__',data:MODEL.selected.loaded},'*');
}

window.rescan = function() {
  init(true);
}

document.querySelector('form.login').addEventListener('submit', e => {
  let data = Object.fromEntries(new FormData(e.target).entries());
  e.preventDefault();
  utilities.serverfetch('/vy/action/__login__',data,r => {
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
    utilities.serverfetch('/vy/action/__menu__',MODEL.menu,null);
    MENU.update();
  }
}

const remove_from_menu = function (v) {
  let idx = MODEL.menu.indexOf(v);
  if (idx > -1) {
    MODEL.menu.splice(idx,1);
    utilities.serverfetch('/vy/action/__menu__',MODEL.menu,null);
    if (v == MODEL.selected.name) MODEL.clear_selected();
    MENU.update();
  }
}

const select_item = function(v) {
  if (!v) return;
  MENU.select(v);
  MODEL.selected.name = v;
}

const compose_view = function(v,episode_suffix) {
  select_item(v);
  let iframe = document.querySelector('div.workspacetabs div.iframe iframe');
  utilities.removeclass('div.workspacetabs div','active');
  utilities.addclass('div.workspacetabs div.iframe','active');
  let split_name = v.split(':');
  let typ = `/vy/action/__${split_name[0]}__`;
  if (['/vy/action/__compose__', '/vy/action/__episode__'].indexOf(typ) > -1) {
    utilities.serverfetch(typ, {name:v,suffix:episode_suffix},function(d) {
      if (d.hasOwnProperty('suffixes')) {
        let butts = '';
        for (var ii = 0; ii < d.suffixes.length; ii++) {
          let s = d.suffixes[ii];
          butts += `<button class="btn btn-sm btn-secondary m-1" data-suffix="${s}">${ii+1}: ${s}</button>`;
        }
        iframe.setAttribute('srcdoc',`<html>
        <head>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous">
        </head>
        ${butts}
        <script>let name="${v}";
        document.addEventListener('click',(ev) => {
          let x = ev.target.closest('button');
          if (x) parent.postMessage({topic:'__sub_episode__', name:name, suffix:x.dataset.suffix},"*");
        })
        </script></html>`);
      } else {
        MODEL.selected.loaded = d;
        let src = (d.hasOwnProperty('html')) ? d.html : '<p>not found</p>';
        iframe.setAttribute('srcdoc',src);
      }
    });
  }
}

window.item_action = function(item, action, kwargs) {
  if (!item) return
  if (action=='remove') {
    remove_from_menu(item);
  } else if (action=='add') {
    add_to_menu(item);
  } else if (action=='compose') {
    compose_view(item,null);
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
  if ((action=='remove') && event.detail <=1 ) return;
  item_action(item, action);
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
