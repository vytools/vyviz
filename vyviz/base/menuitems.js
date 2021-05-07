import { make_item_list } from './model.js';
import { utilities } from './utilities.js';
let LIST = [];

export let MENU = {
  update : function () {
    let div = document.querySelector('div.itemlist');
    while (div.firstChild) { div.removeChild(div.firstChild); }
    make_item_list(LIST,null).forEach(li => {
      li.classList.add('dropzone');
      li.setAttribute('draggable','true');
      div.appendChild(li);    
    });
  },
  select : function (item) {
    utilities.removeclass('div.itemlist li','sel')
    utilities.addclass(`div.itemlist li[data-item='${item}']`,'sel')
  },
  init : function(m) {
    LIST = m;
  }
}

let DRAGGING = null;
document.addEventListener('dragstart', ({target}) => {
  DRAGGING = target.dataset.item;
});
document.addEventListener('dragover', (event) => { event.preventDefault();});
document.addEventListener('drop', ({target}) => {
  if(target.classList.contains('dropzone') && DRAGGING) {
    let old_index = LIST.indexOf(DRAGGING);
    let new_index = LIST.indexOf(target.dataset.item);
    if (new_index >= LIST.length) {
        var k = new_index - LIST.length + 1;
        while (k--) { LIST.push(undefined); }
    }
    LIST.splice(new_index, 0, LIST.splice(old_index, 1)[0]);
    MENU.update();
  }
  DRAGGING = null;
});
