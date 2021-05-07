import { render_editor, message_editor, clear_editor, resize_editor } from './ace_editor.js';

let logace = document.getElementById('logace');
let EDITOR = render_editor(logace);
let ro = new ResizeObserver(entries => {
  for (let entry of entries) {
    if (window.onresize) window.onresize();
    if (EDITOR) resize_editor(EDITOR);
  }
});
ro.observe(logace);

let logsconnection = new WebSocket('ws://'+window.location.host+'/vy/logging');
logsconnection.onmessage = function (e) {
  if (EDITOR && e.data) {
    let msg = JSON.parse(e.data);
    if (msg) message_editor(EDITOR, msg);
  }
};

document.querySelector('i.logs.fa-trash').onclick = function() {
  if (EDITOR) clear_editor(EDITOR);
}
