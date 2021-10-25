import { MODEL } from './model.js';
import { utilities } from './utilities.js';

let CHOICES = new Choices('.itemsearch',{itemSelectText:'',choices:[{label:'',value:''}]});

const i_none = `<i title="This is not a vy image, unknown dependencies" class="fas text-warning fa-question-circle"></i>&nbsp;`;
const i_dep_up = `<i title="This vy item depends on other vy items" class="fas fa-chevron-circle-down"></i>&nbsp;`;
const i_dep_nup = `<i title="This vy item does NOT depend on other vy items" class="fas text-danger fa-times-circle"></i>&nbsp;`;
const i_dep_dn = `<i title="Other vy items depend on this vy item" class="fas fa-chevron-circle-up"></i>&nbsp;`;
const i_dep_ndn = `<i title="Other vy items do NOT depend on this vy item" class="fas text-danger fa-times-circle"></i>&nbsp;`;

let thingtype_button_click_ = function(typ) {
  let i = typ + ':';
  let c = MODEL.ilist.filter(k => k.startsWith(i))
    .map(k => {
      let it = MODEL.items[k];
      let icon1 = it.not_vy ? i_none : ((it.depends_on.length == 0) ? i_dep_nup : i_dep_up);
      let icon2 = it.not_vy ? i_none : ((it.depended_on.length == 0) ? i_dep_ndn : i_dep_dn);
      return {label:icon1+icon2+k.replace(i,''), value:k}
    });
  CHOICES.setChoices(c,'value','label',true);
  // document.querySelector('.itemsearch').innerHTML = MODEL.ilist.filter(k => k.startsWith(i))
  //   .map(k => {
  //     return `<option value="${k}">&#xf111 ${k.replace(i,'')}</option>`;
  //   }).join('');
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
