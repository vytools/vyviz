
const FONTSIZE = 16;

let aceRange = require('ace/range').Range;

export function resize_editor(EDITOR) {
  if (EDITOR) {
    EDITOR.resize();
    EDITOR.setFontSize(FONTSIZE-1);
    EDITOR.setFontSize(FONTSIZE);
  }
}

export function populate_editor(filename, filecontent, EDITOR) {
  if (filecontent) {
    let jsontyp = typeof filecontent === 'object' && filecontent !== null;
    if (jsontyp) filecontent = JSON.stringify(filecontent,null,2);
    EDITOR.setValue(filecontent);
    if (filename.endsWith('.html')) {
      EDITOR.session.setMode("ace/mode/html");  
    } else if (filename.endsWith('.js')) {
      EDITOR.session.setMode("ace/mode/javascript");  
    } else if (jsontyp || filename.endsWith('.json')) {
      EDITOR.session.setMode("ace/mode/json");  
    } else if (filename.startsWith('stage:')) {
      EDITOR.session.setMode("ace/mode/dockerfile");        
    } else if (filename.startsWith('compose:')) {
      EDITOR.session.setMode("ace/mode/yaml");        
    } else {
      EDITOR.session.setMode("ace/mode/text");        
    }
    EDITOR.clearSelection();
    EDITOR.gotoLine(0, 0);
    resize_editor(EDITOR);
  }
}

export function clear_editor(EDITOR) {
  EDITOR.setValue("");
  Object.keys(EDITOR.session.$backMarkers).forEach(k => EDITOR.session.removeMarker(k));
}

export function message_editor(EDITOR, message) {
  if (message.hasOwnProperty('clear')) {
    clear_ace(EDITOR);
  } else {
    var row = EDITOR.session.getLength();
    EDITOR.session.insert({row:row, column: 0}, "\n" + message.message );
    if (message.level) {
      let row2 = EDITOR.session.getLength();
      let rng = new aceRange(row, 0, row2-1, 1);
      EDITOR.session.addMarker(rng, message.level+'_marker', 'fullLine');
    }
    EDITOR.scrollToLine(row, true, true, function () {});
  }
}

export function render_editor(editdiv) {
  let EDITOR = ace.edit(editdiv);
  // ace.config.set("basePath", "https://cdn.jsdelivr.net/ace/1.2.6/noconflict/"); // Need this to get themes etc?

  EDITOR.$blockScrolling = Infinity; // get rid of annoying message
  let acesession = EDITOR.getSession();
  EDITOR.setTheme('ace/theme/twilight');
  acesession.setMode('ace/mode/text'); // 'ace/mode/python'
  EDITOR.setFontSize(FONTSIZE);  // breaks things when I move it after setTabSize and setUseSoftTabs
  acesession.setUseSoftTabs(true);
  acesession.setTabSize(2);
  EDITOR.commands.addCommand({
    name: 'cloudCloseScript',
    bindKey: {win: 'Ctrl-Shift-X',  mac: 'Command-Shift-X'},
    exec: function(env, args, request) {EDITOR.setValue("");},
    readOnly: true // false if this command should not apply in readOnly mode
  });
  EDITOR.clearSelection();
  EDITOR.gotoLine(0, 0);
  EDITOR.focus();
  EDITOR.setReadOnly(true);

  // acex.resize();
  // var row = acex.session.getLength();
  // acex.session.insert({row:row, column: 0}, "\n" + log );
  // //acex.scrollToLine(row, true, true, function () {});
  // acex.renderer.scrollCursorIntoView({row: row, column: 0}, 1)
  return EDITOR;
}
