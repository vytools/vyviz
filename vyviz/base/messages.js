import { utilities } from './utilities.js';

let update_messages = function(msgdiv, msgs) {
  utilities.remove_all_child_nodes(msgdiv);
  Object.keys(msgs).forEach(function(k) {
    let m = msgs[k];
    let mdiv = document.createElement('div');
    mdiv.classList.add('alert','alert-'+m.level,'mb-1');
    mdiv.textContent = m.message;
    msgdiv.appendChild(mdiv);
  });
}

// Client messages
let CLIENT_MESSAGES = {};
let servermsgdiv = document.querySelector('div.mymessages'); 
window.set_message = function(topic,level,msg,timeout) {
  if (!servermsgdiv) return;
  if (CLIENT_MESSAGES[topic] && CLIENT_MESSAGES[topic].timeout) {
    clearTimeout(CLIENT_MESSAGES[topic].timeout);
  }
  CLIENT_MESSAGES[topic] = {level:level,message:msg,timeout:setTimeout(()=> {
    delete CLIENT_MESSAGES[topic]
    update_messages(servermsgdiv, CLIENT_MESSAGES);
  },1000*((timeout > 0) ? timeout : 10))};
  update_messages(servermsgdiv, CLIENT_MESSAGES);
}
window.set_message('welcome','info','hi',2);


// Server messages
let connection = new WebSocket('ws://'+window.location.host+'/vy/server_status');
connection.onmessage = function (e) {
  let server_statuses = JSON.parse(e.data);
  update_messages(servermsgdiv, server_statuses);
};
