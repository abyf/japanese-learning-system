/**
 * One-off cleanup: remove decorative/AI-looking emoji from the UI.
 * - Status emoji become plain typographic glyphs (checkmark, circle, dot).
 * - Speaker emoji becomes a small music note.
 * - All other pictographs / flags are removed.
 * Keeps functional glyphs: check, cross, arrows, play, and Japanese text.
 *
 * Run:  node scripts/strip-emoji.js
 */
const fs = require('fs');
const path = require('path');

// Applied first (contextual replacements)
const special = [
  ['\u2705', '\u2713'],   // white heavy check ✅ -> ✓
  ['\u2B1C', '\u25CB'],   // white large square ⬜ -> ○
  ['\uD83D\uDFE1', '\u25CF'], // yellow circle 🟡 -> ●
  ['\uD83D\uDD0A', '\u266A']  // speaker 🔊 -> ♪
];

// Emoji to remove entirely (with adjacent space collapse)
const remove = [
  '\uD83C\uDF89', // 🎉
  '\uD83D\uDCDD', // 📝
  '\uD83D\uDCD6', // 📖
  '\uD83C\uDFA7', // 🎧
  '\u270D\uFE0F', // ✍️
  '\u270D',       // ✍
  '\uD83D\uDCDA', // 📚
  '\uD83D\uDCC5', // 📅
  '\uD83C\uDFAF', // 🎯
  '\uD83D\uDCD8', // 📘
  '\uD83D\uDE4F', // 🙏
  '\uD83D\uDCA0', // 💠
  '\uD83D\uDCD0', // 📐
  '\uD83D\uDD17', // 🔗
  '\uD83C\uDF93', // 🎓
  '\u270F\uFE0F', // ✏️
  '\u270F',       // ✏
  '\uD83D\uDD25', // 🔥
  '\uD83D\uDD12', // 🔒
  '\uD83C\uDDEC\uD83C\uDDE7', // 🇬🇧
  '\uD83C\uDDEB\uD83C\uDDF7', // 🇫🇷
  '\uD83C\uDDE7\uD83C\uDDF7', // 🇧🇷
  '\uFE0F'        // stray variation selector
];

function clean(text) {
  var out = text;
  special.forEach(function(pair) {
    out = out.split(pair[0]).join(pair[1]);
  });
  remove.forEach(function(e) {
    // remove emoji plus one adjacent space to avoid double spaces
    out = out.split(e + ' ').join('');
    out = out.split(' ' + e).join('');
    out = out.split(e).join('');
  });
  return out;
}

var targets = [];
var pagesDir = path.join(__dirname, '..', 'public', 'pages');
var jsDir = path.join(__dirname, '..', 'public', 'js');
fs.readdirSync(pagesDir).filter(f => f.endsWith('.js')).forEach(f => targets.push(path.join(pagesDir, f)));
fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).forEach(f => targets.push(path.join(jsDir, f)));

var changed = 0;
targets.forEach(function(file) {
  var before = fs.readFileSync(file, 'utf8');
  var after = clean(before);
  if (before !== after) {
    fs.writeFileSync(file, after, 'utf8');
    changed++;
    console.log('cleaned', path.relative(path.join(__dirname, '..'), file));
  }
});
console.log('Files changed:', changed);
