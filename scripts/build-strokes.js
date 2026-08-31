/**
 * build-strokes.js
 *
 * Builds an offline stroke-order dataset for every hiragana, katakana and
 * kanji character taught in the app, using the open-source KanjiVG project
 * (https://github.com/KanjiVG/kanjivg, licence CC-BY-SA 3.0).
 *
 * For each character it downloads the matching KanjiVG SVG (named by Unicode
 * codepoint, e.g. 03042.svg for あ), extracts the ordered list of stroke path
 * "d" attributes and the viewBox, and writes a compact JSON keyed by the
 * character:  content/kana/strokes.json
 *
 * Runtime never touches the network — this script is run once at build time
 * (and again only if the character set changes). Re-run with:
 *
 *   node scripts/build-strokes.js
 *
 * KanjiVG data is CC-BY-SA 3.0; attribution is shown in the app footer/README.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const CONTENT_DIR = path.join(__dirname, '..', 'content', 'kana');
const SOURCE_FILES = ['hiragana.json', 'katakana.json', 'kanji-n5.json'];
const OUT_FILE = path.join(CONTENT_DIR, 'strokes.json');
const BASE_URL = 'https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/';

// KanjiVG file names are 5-hex-digit, zero-padded, lowercase codepoints.
function codepointFile(ch) {
  const cp = ch.codePointAt(0).toString(16).toLowerCase();
  return cp.padStart(5, '0') + '.svg';
}

function collectCharacters() {
  const chars = new Set();
  for (const f of SOURCE_FILES) {
    const data = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, f), 'utf8'));
    (data.groups || []).forEach(g => {
      (g.characters || []).forEach(c => {
        if (c.kana && Array.from(c.kana).length === 1) chars.add(c.kana);
      });
    });
  }
  return Array.from(chars);
}

function fetchSvg(fileName) {
  return new Promise((resolve, reject) => {
    https.get(BASE_URL + fileName, res => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode + ' for ' + fileName));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => (body += c));
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });
}

/**
 * Extract ordered stroke path data from a KanjiVG SVG string.
 * Strokes appear as <path id="kvg:XXXXX-sN" d="..."/> in document order,
 * which is the correct writing order.
 */
function parseStrokes(svg) {
  const paths = [];
  const re = /<path[^>]*\sd="([^"]+)"[^>]*\/?>/g;
  let m;
  while ((m = re.exec(svg)) !== null) {
    paths.push(m[1].trim());
  }
  // KanjiVG uses a 109x109 canvas.
  let viewBox = '0 0 109 109';
  const vb = svg.match(/viewBox="([^"]+)"/);
  if (vb) viewBox = vb[1];
  return { viewBox, paths };
}

async function main() {
  const chars = collectCharacters();
  console.log('Characters to fetch:', chars.length);

  const out = { _license: 'Stroke data derived from KanjiVG (https://kanjivg.tagaini.net/), CC-BY-SA 3.0', viewBox: '0 0 109 109', characters: {} };
  let ok = 0, fail = 0;
  const failed = [];

  for (const ch of chars) {
    const file = codepointFile(ch);
    try {
      const svg = await fetchSvg(file);
      const parsed = parseStrokes(svg);
      if (!parsed.paths.length) throw new Error('no strokes parsed');
      out.characters[ch] = parsed.paths;
      out.viewBox = parsed.viewBox;
      ok++;
      if (ok % 25 === 0) console.log('  fetched', ok, '/', chars.length);
    } catch (err) {
      fail++;
      failed.push(ch);
      console.warn('  MISS', ch, file, '-', err.message);
    }
    // Be polite to the server.
    await new Promise(r => setTimeout(r, 60));
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(out));
  const sizeKb = Math.round(fs.statSync(OUT_FILE).size / 1024);
  console.log('\nDone. ' + ok + ' ok, ' + fail + ' missing. Wrote ' + OUT_FILE + ' (' + sizeKb + ' KB)');
  if (failed.length) console.log('Missing characters:', failed.join(' '));
}

main().catch(err => { console.error(err); process.exit(1); });
