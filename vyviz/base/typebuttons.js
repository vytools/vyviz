import { MODEL } from './model.js';
import { utilities } from './utilities.js';

let CHOICES = new Choices('.itemsearch',{itemSelectText:'',choices:[{label:'',value:''}]});

let thingtype_button_click_ = function(typ) {
  let i = typ + ':';
  let c = MODEL.ilist.filter(k => k.startsWith(i))
    .map(k => {return {label:k.replace(i,''), value:k}});
  CHOICES.setChoices(c,'value','label',true);
  utilities.removeclass('.thingtype button','active');
  utilities.addclass(`.thingtype button.item-${typ}`,'active');
}

let thingtype_button_click = function() {
  thingtype_button_click_(this.dataset.label);
}

export function type_buttons() {
  let ib = document.querySelector('.thingtype');
  utilities.remove_all_child_nodes(ib);
  for (var key in MODEL.config.thingtypes) {
    let thingtype = MODEL.config.thingtypes[key];
    let b = document.createElement('button');
    b.setAttribute('class', `btn item-${key} color-${thingtype.color}-3 color-${thingtype.color}-bg`);
    b.setAttribute('data-label',key);
    b.onclick = thingtype_button_click;
    b.textContent = thingtype.bl;
    ib.appendChild(b);
    thingtype_button_click_('x');
  };
}
