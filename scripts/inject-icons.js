/** One-off: inject animated result-banner icons into activity result screens. */
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'public', 'pages');

['reading', 'listening', 'dictation'].forEach(function(f) {
  var p = path.join(dir, f + '.js');
  var s = fs.readFileSync(p, 'utf8');
  var before = s;
  s = s.split("'<span class=\"result-banner__text\">' + window.i18n('result.completed')")
       .join("(window.Icons ? window.Icons.celebrate(38) : '') + '<span class=\"result-banner__text\">' + window.i18n('result.completed')");
  s = s.split("'<span class=\"result-banner__text\">' + window.i18n('result.notQuite')")
       .join("(window.Icons ? window.Icons.tryagain(34) : '') + '<span class=\"result-banner__text\">' + window.i18n('result.notQuite')");
  if (s !== before) { fs.writeFileSync(p, s, 'utf8'); console.log('updated', f + '.js'); }
  else console.log('no change', f + '.js');
});
