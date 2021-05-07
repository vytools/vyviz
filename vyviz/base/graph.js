const TWOPI = Math.PI*2;
let add_svg = function(diameter) {
  let svg = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
  svg.setAttribute('width',`${diameter}px`)
  svg.setAttribute('height',`${diameter}px`)
  svg.setAttribute('viewbox',`0 0 ${diameter} ${diameter}`);
  return svg;
}

export function partition_graph(root, graph, dep_list_key) {
  let n = 0;
  let items = [];
  let found = [];
  let add_depth = function(i, depth) {
    if (!graph.hasOwnProperty(i)) return 0;
    let item = JSON.parse(JSON.stringify(graph[i]));
    item.graphp = {depth:depth,dq:0,q0:0,duplicate:found.indexOf(i) > -1};
    let n1 = items.length;
    if (!item.graphp.duplicate) {
      if (item.hasOwnProperty(dep_list_key)) {
        for (var mm = item[dep_list_key].length-1; mm >= 0; mm--) {
          item.graphp.dq += add_depth(item[dep_list_key][mm], depth+1);
        }
      }
      found.push(i);
    }
    let n2 = items.length;
    if (item.graphp.dq == 0) {
      item.graphp.dq = 1;
      n += 1;
    }
    for (var ii = n1; ii < n2; ii++) { 
      if (!items[ii].graphp.hasOwnProperty('parent')) items[ii].graphp.parent = n2;
    }
    items.push(item);
    return item.graphp.dq;
  }

  add_depth(root, 0);
  items.reverse(); // root item is now listed first
  let depths = {};
  items.forEach(i => { 
    i.graphp.dq = i.graphp.dq*2*Math.PI/n;
    if (i.graphp.hasOwnProperty('parent')) i.graphp.parent = items.length - 1 - i.graphp.parent;
    let labl = i.graphp.depth + '_' + i.graphp.parent;
    if (depths.hasOwnProperty(labl)) {
      i.graphp.q0 = depths[labl];
    } else if (i.graphp.depth > 0) {
      i.graphp.q0 = items[i.graphp.parent].graphp.q0;
      depths[labl] = i.graphp.q0;
    }
    depths[labl] += i.graphp.dq;
  });
  return items;
}

export function svg_partition_graph(diameter, items) {
  let svg = add_svg(diameter);
  let radius = parseInt(diameter/2), cx = radius, cy = radius;
  let max_depth = 1+Math.max(...items.map(i => i.graphp.depth));
  let dradius = (radius/Math.max(max_depth,4));
  let buffer_rad = radius/100;
  items.forEach(item => {
    let buffer = (item.graphp.dq > 0.999*TWOPI) ? 0 : buffer_rad;
    let innerRadius = item.graphp.depth*dradius;
    let outerRadius = (item.graphp.depth+1)*dradius;
    let circle = document.createElementNS("http://www.w3.org/2000/svg", 'circle')
    let r = (innerRadius+outerRadius)/2;
    let dr = (outerRadius-innerRadius);
    let arclen = item.graphp.dq*r - buffer;
    let perim = r*TWOPI;
    let offset = (TWOPI-(item.graphp.q0+item.graphp.dq))*r + buffer/2;
    circle.setAttribute('cx',`${cx}px`)
    circle.setAttribute('cy',`${cy}px`)
    circle.setAttribute('r',`${r}px`)
    circle.setAttribute('stroke-width',`${dr-buffer_rad}px`)
    circle.setAttribute('fill','none')
    circle.setAttribute('opacity','0.7')
    circle.setAttribute('stroke-dasharray',`${arclen} ${perim-arclen}`)
    circle.setAttribute('stroke-dashoffset',`${-offset}`)
    if (item.graphp.class) circle.setAttribute('class',item.graphp.class)
    if (item.graphp.onmouseover) circle.setAttribute('onmouseover',item.graphp.onmouseover);
    if (item.graphp.onmousemove) circle.setAttribute('onmousemove',item.graphp.onmousemove);
    if (item.graphp.onmousedown) circle.setAttribute('onmousedown',item.graphp.onmousedown);
    if (item.graphp.onmouseup) circle.setAttribute('onmouseup',item.graphp.onmouseup);
    if (item.graphp.onmouseout) circle.setAttribute('onmouseout', item.graphp.onmouseout);
    if (item.graphp.onclick) circle.setAttribute('onclick', item.graphp.onclick);
    if (item.graphp.ondblclick) circle.setAttribute('ondblclick', item.graphp.ondblclick);
    if (item.graphp.oncontextmenu) circle.setAttribute('oncontextmenu', item.graphp.oncontextmenu);
    svg.appendChild(circle);
  });
  return svg;
}
