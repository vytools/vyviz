let CALLBACKS = {
  server_subscribers:[],
  reload:[],
  artifact:{},
  publish:{},
  calibrate:{}
}
let CALIBRATION = {};
let ANCHORS = {};

window.VY_DIAGNOSTICS = {
  FAILED_POST:{},
  success_post:function(topic) { if (this.FAILED_POST.hasOwnProperty(topic)) delete this.FAILED_POST[topic]; },
  failed_post:function(topic,err) { this.FAILED_POST[topic] = err; },
  calibration:function() { return JSON.parse(JSON.stringify(CALIBRATION))},
  callbacks:function() {
    console.log(`server_subscribers = `,CALLBACKS.server_subscribers);
    console.log(`There are ${CALLBACKS.reload.length} reload callbacks`);
    ['publish','artifact','calibrate'].forEach(function(typ) {
      Object.keys(CALLBACKS[typ]).forEach(function(k) {
        console.log(`There are ${CALLBACKS[typ][k].length} ${k} ${typ} callbacks`);
      });
    });
  }
}

const throttled_callback = function(typ,key,data) {
  let f = CALLBACKS[typ][key];
  if (f) {
    f.forEach(cb => {
      if (Date.now() - cb.t_last > cb.throttle_ms) {
        try { cb.callback(data); } catch(err) { console.error(typ,key,data,err); }
        cb.t_last = Date.now();
      }
    });
  }
} 

const calibrate = function(obj, force) {
  let copy = JSON.parse(JSON.stringify(obj));
  Object.keys(obj).forEach(function(k) {
    if (force || CALIBRATION.hasOwnProperty(k)) CALIBRATION[k] = copy[k];
    throttled_callback('calibrate',k,obj[k]);
  });
}

const register_a_callback = function(typ,name,cb,opts) {
  if (!CALLBACKS[typ][name]) CALLBACKS[typ][name] = [];
  let throttle_ms = (opts && opts.hasOwnProperty('throttle_ms')) ? opts.throttle_ms : 0
  CALLBACKS[typ][name].push({
    callback:cb,
    throttle_ms:throttle_ms,
    t_last:Date.now()
  });
}

const vyfetch = function(topic,d,cb) {
  if (window.VY_FETCH) {
    VY_FETCH(topic,d,cb);
  }
}

export const VY = {
  log : {
    clear : console.clear,
    write : console.log,
  },
  fetch: vyfetch,
  calibrate: function(obj) {    calibrate(obj,false); },
  engine_publish: function(topic, data, cb) {
    if (CALLBACKS.server_subscribers.indexOf(topic) > -1) {
      vyfetch(topic, data, function(result) {if (cb) cb(result)});
    }
  },
  publish_calibrate : function(topic, cal) {
    this.on_calibrate(cal, d => this.publish(topic,d));
    this.on_publish(topic, d => this.calibrate(cal,d));
  },
  publish: function(topic,d) {  throttled_callback('publish',topic,d); },
  on_calibrate: function(topic, cb, options) {
    let opts = (options) ? options : {};
    register_a_callback('calibrate',topic,cb,opts);
    if (CALIBRATION.hasOwnProperty(topic)) {
      let copy = (typeof CALIBRATION[topic] == 'object') ? 
        JSON.parse(JSON.stringify(CALIBRATION[topic])) : CALIBRATION[topic];
      cb(copy); 
    } else if (CALIBRATION && topic == '.') {
      cb(JSON.parse(JSON.stringify(CALIBRATION)));
    }

  },
  on_artifact: function(artifact_name, cb, options) {
    let opts = (options) ? options : {};
    register_a_callback('artifact', artifact_name, cb, opts)
  },
  on_reload: function(cb) { CALLBACKS.reload.push(cb); },
  on_publish: function(topic, cb, options) {   
    let opts = (options) ? options : {};
    register_a_callback('publish', topic, cb, opts);
  },
  anchors: function() {
    return JSON.parse(JSON.stringify(ANCHORS));
  }
};

const load_item = function(loaded) {
  if (!loaded) return;
  ANCHORS = loaded.anchors;
  // if (loaded.server_subscribers && loaded.server_subscribers.length > 0) 
  //   CALLBACKS.server_subscribers = loaded.server_subscribers;
  // if (loaded.calibration) calibrate(loaded.calibration, true);
  throttled_callback('calibrate','-',JSON.parse(JSON.stringify(ANCHORS)));
  Object.keys(CALLBACKS.artifact).forEach(function(artifact_name) {
    vyfetch('/vy/__artifact__',{name:loaded.name, artifact:artifact_name},
      art => throttled_callback('artifact',artifact_name,art));
  });
}

// RUNNING IN IFRAME ***********************************************************
window.VY_IDS = {};
window.VY_FETCH = function(topic,d,cb) {
  let id = '_'+Math.random().toString(36).substring(2, 15)+Math.random().toString(36).substring(2, 15);
  if (cb) window.VY_IDS[id] = cb;
  window.parent.postMessage({topic:topic, data:d, id:id},'*');
  // not in iframe?...
  // fetch('/vy/'+topic, jsonpack(d))
  //   .then(data=>{return data.json()})
  //   .then(res=>{ if (cb) cb(res); VY_DIAGNOSTICS.success_post(topic) })
  //   .catch(error=>{VY_DIAGNOSTICS.failed_post(topic,error); })
}
window.addEventListener('message', function (e) {
  if (e.data.id == '__initialize__') {
    load_item(e.data.data);
  } else if (e.data.id && VY_IDS.hasOwnProperty(e.data.id)) {
    VY_IDS[e.data.id](e.data.data);
    delete VY_IDS[e.data.id];
  }
});
// RUNNING IN IFRAME ***********************************************************

