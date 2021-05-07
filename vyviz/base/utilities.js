export const utilities = {

  remove_all_child_nodes : function(parent) {
    while (parent.firstChild) { parent.removeChild(parent.firstChild); }
  },
  
  removeclass : function(slctr, cls) { 
    [].forEach.call(document.querySelectorAll(slctr), el => el.classList.remove(cls));
  },

  addclass : function(slctr, cls) { 
    [].forEach.call(document.querySelectorAll(slctr), el => el.classList.add(cls));
  },

  toggleclass : function(slctr, cls) { 
    [].forEach.call(document.querySelectorAll(slctr), el => el.classList.toggle(cls));
  },

  serverfetch : function(topic,d,cb) {
    fetch(topic, {
        headers:{"content-type":"application/json; charset=UTF-8"},
        body:JSON.stringify(d),
        method:"POST"
      })
      .then(response=>{
        const contentType = response.headers.get("content-type");
        return (contentType && contentType.indexOf("application/json") !== -1)
          ? response.json() : response.text();
      })
      .then(res=>{ if (cb) cb(res); })
      .catch(error=>console.error(`Failed in fetch or callback of ${topic} with data ${JSON.stringify(d)}: ${error}`))
  },

  get_event_target : function(e) {
    e = e || window.event;
    return e.target || e.srcElement; 
  },
  
  get_data_until : function(t,i,u) {
    return ((!t) ? null : (t.dataset[i]) ? t.dataset[i] : 
      ((t.tagName == u) ? null : this.get_data_until(t.parentElement,i,u)));
  }

}
