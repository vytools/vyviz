import { MODEL } from './model.js';
import { partition_graph, svg_partition_graph } from './graph.js';
import { utilities } from './utilities.js';
import { resize_editor, populate_editor } from './ace_editor.js';

let EDITOR_ITEM = null;
let EDITOR = null;
let tooltip = document.querySelector("div.globaltooltip");
// let overlay = document.querySelector('.overlay');

const get_detailview = function() {
  utilities.removeclass('div.workspacetabs div','active');
  utilities.addclass('div.workspacetabs .detailview','active');
  return document.querySelector('div.workspacetabs .detailview');
}

const is_detailview = function() {
  return document.querySelector('div.workspacetabs .detailview').classList.contains('active');
}

const set_editor = function(item, EDITOR) {
  let d = document.querySelector('.itemcontents .graphheader');
  if (!d) return;
  d.innerHTML = `${item}<br/><span><small>contents:</small></span>`;
  EDITOR_ITEM = item;
  if (item.startsWith('repo:') || item.startsWith('vydir:') || item.startsWith('image:')) {
    populate_editor(item+'.json', JSON.stringify(MODEL.items[item],null,2), EDITOR);
  } else {
    utilities.serverfetch('/vy/__item__',{name:item},function(res) {
      if (res) populate_editor(item, res, EDITOR);
    })
  }
}

window.showTooltip = function(evt, text) {
  tooltip.innerHTML = text;
  tooltip.style.display = "block";
  tooltip.style.left = evt.pageX + 10 + 'px';
  tooltip.style.top = evt.pageY + 10 + 'px';
}

window.hideTooltip = function() {
  tooltip.style.display = "none";
  if (EDITOR_ITEM != MODEL.selected.name) {
    set_editor(MODEL.selected.name, EDITOR);
  }
  // overlay.style.display = "none";
}

window.click_graph_item = function(evt, item) {
  if (evt.detail == 1) {
    set_editor(item,  EDITOR);
  } else if (evt.detail == 2) {
    add_to_menu(item);
  } else if (evt.detail == 3) {
    item_action(item,'graph');
  }
  // overlay.style.display = "block";
  // overlay.innerText = item
}

let DEPENDS = null;
let DEPENDED = null;

export function draw_graph() {
  if (!MODEL.selected.name || !is_detailview()) return
  let div = get_detailview();
  let topflex = div.querySelector('flex');
  let itemdep = topflex.querySelector('.itemdependencies');
  let itemcon = topflex.querySelector('.itemcontents');
  let divA = itemdep.querySelector('.dependson');
  let divB = itemdep.querySelector('.dependedon');
  let hA = divA.querySelector('.graphheader');
  let hB = divB.querySelector('.graphheader');
  let w = div.offsetWidth, h = div.offsetHeight;
  let headerheight = hB.offsetHeight;
  if (w == 0 || h == 0) { w = 400; h = 400 };
  let r = 0;
  if (h<w && h/2-headerheight > 150) {
    r = h/2 - headerheight;
    topflex.classList.remove('v')
    topflex.classList.add('h');
    itemdep.classList.remove('h');
    itemdep.classList.add('v');
    if (r < 150) return;
    // div.style.flexDirection = 'row';
    itemcon.style.flex = w/r-1;
  } else if (w/2-headerheight > 150) {
    r = w/2;
    topflex.classList.remove('h')
    topflex.classList.add('v');
    itemdep.classList.remove('v');
    itemdep.classList.add('h');
    if (r < 150) return;
    // div.style.flexDirection = 'column';
    itemcon.style.flex = h/(r+headerheight) - 1;
  }

  hA.innerHTML = `${MODEL.selected.name}<br/><span><small><i class="fas fa-chevron-circle-down"></i> depends on:</small></span>`
  hB.innerHTML = `${MODEL.selected.name}<br/><span><small><i class="fas fa-chevron-circle-up"></i> depended on by:</small></span>`
  let svgA = divA.querySelector('svg'); if (svgA) svgA.parentNode.removeChild(svgA);
  let svgB = divB.querySelector('svg'); if (svgB) svgB.parentNode.removeChild(svgB);
  svgA = svg_partition_graph(r, DEPENDS);
  svgB = svg_partition_graph(r, DEPENDED);
  divA.appendChild(svgA);
  divB.appendChild(svgB);
  resize_editor(EDITOR);
}

const add_graph_actions = function(item) {
  item.graphp.class = `color-${MODEL.config.thingtypes[item.thingtype].color}-svg`;
  // item.graphp.onmouseover = `console.log('over ${item.thingtype+':'+item.name}')`;
  item.graphp.onclick = `click_graph_item(evt,'${item.thingtype+':'+item.name}');`;
  item.graphp.onmousemove=`showTooltip(evt, '${item.thingtype+':'+item.name}');`;
  item.graphp.onmouseout="hideTooltip();";
}

export function add_graphs() {
  if (!EDITOR) {
    EDITOR = ace.edit("itemtext");
    // EDITOR.setTheme("ace/theme/twilight");
    EDITOR.setTheme("ace/theme/github");
  }
  DEPENDED = partition_graph(MODEL.selected.name, MODEL.items, 'depended_on');
  DEPENDS = partition_graph(MODEL.selected.name, MODEL.items, 'depends_on');
  DEPENDS.forEach(add_graph_actions);
  DEPENDED.forEach(add_graph_actions);
  set_editor(MODEL.selected.name, EDITOR);
  get_detailview();
}

