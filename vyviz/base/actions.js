import { utilities } from './utilities.js';
import { MODEL } from './model.js';

const try_delete = function(name) {
  let item = MODEL.itmscontent[name];
  if (item.depended_on.length == 0) {
    let c = prompt(`Are you sure you want to PERMANENTLY delete "${name}". Type "yes" and click ok`);
    if (c == "yes") {
      utilities.serverfetch('/vy/action/__delete__',{name:name},(r) => {
        if (r.success) window.rescan();
      });
    }
  } else {
    window.set_message('delete','danger','Cannot delete item that is depended on by other items',4);
  }
}

const B = '&nbsp;<span class="badge rounded-pill bg-dark">B</span>';
const A = '&nbsp;<span class="badge rounded-pill bg-dark">A</span>';
const BA = '&nbsp;<span class="badge rounded-pill bg-dark">BA</span>';
const fR = '<i class="fas fa-running"></i>'
const fB = '<i class="fas fa-hard-hat"></i>'

const buildtitle = '(click) Build without building dependencies (right click) to toggle dependencies';
const runtitle = '(click) Run without building anything (right click) to toggle build dependencies';
const build_mode = function(e,toggle) {
  e.preventDefault();
  e.stopPropagation();
  let button = e.target.closest('button');
  let action = button.dataset.action;
  if (action == 'build') {
    if (toggle) {
      button.dataset.action = 'build all';
      button.title = '(click) Build with all dependencies (right click) to toggle dependencies';
      button.innerHTML = fB+A;
    } else if (MODEL && MODEL.selected && MODEL.selected.name) {
      utilities.serverfetch('/vy/action/__build__',{list:[MODEL.selected.name],kwargs:{"anchors":{}, "build_level":1}});
    }
  } else {
    if (toggle) {
      button.dataset.action = 'build';
      button.title = buildtitle;
      button.innerHTML = fB;
    } else if (MODEL && MODEL.selected && MODEL.selected.name) {
      utilities.serverfetch('/vy/action/__build__',{list:[MODEL.selected.name],kwargs:{"anchors":{}, "build_level":0}});
    }
  }
}

const run_mode = function(e,toggle) {
  e.preventDefault();
  e.stopPropagation();
  let button = e.target.closest('button');
  let action = button.dataset.action;
  if (action == 'run') {
    if (toggle) {
      button.dataset.action = 'run build';
      button.title = '(click) Build then run (right click) to toggle build dependencies';
      button.innerHTML = fR+B;
    } else if (MODEL && MODEL.selected && MODEL.selected.name) {
      utilities.serverfetch('/vy/action/__run__',{list:[MODEL.selected.name],kwargs:{"anchors":{}, "clean":false}});
    }
  } else if (action == 'run build') {
    if (toggle) {
      button.dataset.action = 'run build all';
      button.title = '(click) Build all dependencies then run (right click) to toggle build dependencies';
      button.innerHTML = fR+BA;
    } else if (MODEL && MODEL.selected && MODEL.selected.name) {
      console.log('run build')
    }
  } else {
    if (toggle) {
      button.dataset.action = 'run';
      button.title = runtitle;
      button.innerHTML = fR;
    } else if (MODEL && MODEL.selected && MODEL.selected.name) {
      console.log('run build all')
    }
  }
}

// if args.build:
// br = vytools.build(lst, anchors=anchors, build_level=build_level, compose=rootcompose)
// if br == False: return False
// return bool(vytools.run(lst, anchors=anchors, clean=args.clean, save=args.save, object_mods=object_mods, cmd=cmd, persist=persist, compose=rootcompose))


let BuildButton = document.querySelector('button.buildthing');
let RunButton = document.querySelector('button.runthing');
let DeleteButton = document.querySelector('button.deletething');
BuildButton.title = buildtitle;
RunButton.title = runtitle;
BuildButton.onclick = function(e) {       build_mode(e,false);  }
BuildButton.oncontextmenu = function(e) { build_mode(e,true);  }
RunButton.onclick = function(e) {         run_mode(e,false);  }
RunButton.oncontextmenu = function(e) {   run_mode(e,true);  }
DeleteButton.onclick = function(e) {      
  if (MODEL && MODEL.selected && MODEL.selected.name) try_delete(MODEL.selected.name);
}