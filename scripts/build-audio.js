/**
 * build-audio.js
 *
 * Generates human-quality Japanese pronunciation audio for every kana/kanji
 * character, example word, and vocabulary word/sentence used in the app, using
 * Amazon Polly NEURAL voices (Takumi male, Kazuha female). Runs ONCE at build
 * time; the app then serves the bundled MP3s locally — zero runtime AWS cost.
 *
 * Output:
 *   content/audio/tts/<sha1(text)>.mp3     one file per unique Japanese string
 *   content/audio/manifest.json            { text -> { file, voice } } index
 *
 * Requirements:
 *   - AWS credentials configured (profile "default" or env), region us-east-1.
 *   - IAM permission polly:SynthesizeSpeech.
 *   - AWS CLI available (this script shells out to it, so no npm SDK needed).
 *
 * Usage:
 *   node scripts/build-audio.js            generate any missing clips
 *   node scripts/build-audio.js --force    regenerate everything
 *   node scripts/build-audio.js --voice Kazuha
 *
 * Re-run any time content changes; existing clips are skipped unless --force.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const KANA_DIR = path.join(CONTENT, 'kana');
const VOCAB_DIR = path.join(CONTENT, 'vocabulary');
const OUT_DIR = path.join(CONTENT, 'audio', 'tts');
const MANIFEST = path.join(CONTENT, 'audio', 'manifest.json');

const REGION = process.env.AWS_REGION || 'us-east-1';
const FORCE = process.argv.includes('--force');
const voiceArgIdx = process.argv.indexOf('--voice');
const DEFAULT_VOICE = voiceArgIdx !== -1 ? process.argv[voiceArgIdx + 1] : 'Takumi';

// Locate the AWS CLI (PATH, or the standard Windows install location).
function awsBin() {
  const candidates = [
    'aws',
    'C:\\Program Files\\Amazon\\AWSCLIV2\\aws.exe',
    '/usr/local/bin/aws',
    '/usr/bin/aws'
  ];
  for (const c of candidates) {
    try {
      execFileSync(c, ['--version'], { stdio: 'ignore' });
      return c;
    } catch (e) { /* try next */ }
  }
  throw new Error('AWS CLI not found. Install it and configure credentials.');
}

const AWS = awsBin();

function sha1(text) {
  return crypto.createHash('sha1').update(text, 'utf8').digest('hex');
}

/**
 * Collect every unique Japanese string we need audio for, tagging each with a
 * preferred voice so the set does not all sound identical:
 *   - kana characters + kanji example words + vocab words -> Takumi (male)
 *   - vocabulary example sentences                        -> Kazuha (female)
 */
// Does a string contain any Japanese (kana or kanji)? Skips English-only fields.
function hasJapanese(s) {
  return /[\u3040-\u30ff\u3400-\u9fff\uff66-\uff9f]/.test(s || '');
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

// Recursively walk a JSON value, adding any Japanese string found under keys
// that represent spoken text.
function harvest(node, add, voice) {
  if (node == null) return;
  if (typeof node === 'string') { if (hasJapanese(node)) add(node, voice); return; }
  if (Array.isArray(node)) { node.forEach(function(x) { harvest(x, add, voice); }); return; }
  if (typeof node === 'object') {
    Object.keys(node).forEach(function(k) { harvest(node[k], add, voice); });
  }
}

function walkDir(dir, cb) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function(ent) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkDir(full, cb);
    else if (ent.name.endsWith('.json')) cb(full);
  });
}

function collectTexts() {
  const map = new Map(); // text -> { voice }

  function add(text, voice, opts) {
    text = (text || '').trim();
    if (!text || !hasJapanese(text)) return;
    var allowLong = opts && opts.allowLong;
    var len = Array.from(text).length;
    // Cap short-content harvest at 120 chars; allow full transcripts/dictation
    // (they are played whole) up to Polly's neural request limit.
    if (!allowLong && len > 120) return;
    if (len > 2900) return; // Polly neural per-request character limit safeguard
    if (!map.has(text)) map.set(text, { voice: voice || DEFAULT_VOICE });
  }

  // Kana / kanji: character + example word (male voice).
  ['hiragana.json', 'katakana.json', 'kanji-n5.json'].forEach(function(f) {
    const d = readJson(path.join(KANA_DIR, f));
    if (!d) return;
    (d.groups || []).forEach(function(g) {
      (g.characters || []).forEach(function(c) {
        if (c.kana) add(c.kana, 'Takumi');
        if (c.example && c.example.word) add(c.example.word, 'Takumi');
      });
    });
  });

  // Vocabulary: words (male), example sentences (female).
  walkDir(VOCAB_DIR, function(p) {
    const arr = readJson(p);
    (Array.isArray(arr) ? arr : []).forEach(function(v) {
      if (v.word) add(v.word, 'Takumi');
      if (v.exampleSentence) add(v.exampleSentence, 'Kazuha');
    });
  });

  // Dictation exercises: spoken target text (female — full sentences).
  walkDir(path.join(CONTENT, 'audio', 'dictation'), function(p) {
    const d = readJson(p);
    if (!d) return;
    const t = d.speechText || d.expectedText || d.text;
    if (t) add(t, 'Kazuha', { allowLong: true });
  });

  // Listening exercises: transcript (female — full sentences/dialogue).
  walkDir(path.join(CONTENT, 'audio', 'listening'), function(p) {
    const d = readJson(p);
    if (!d) return;
    if (d.transcript) add(d.transcript, 'Kazuha', { allowLong: true });
    if (d.speechText) add(d.speechText, 'Kazuha', { allowLong: true });
  });

  // Grammar, guides, drills, shadowing, deep dives, exams: harvest every
  // Japanese string (examples, prompts, items). Words/short phrases dominate.
  ['grammar', 'guides', 'drills', 'shadowing', 'deepdive', 'exams'].forEach(function(sub) {
    walkDir(path.join(CONTENT, sub), function(p) {
      const d = readJson(p);
      harvest(d, add, 'Takumi');
    });
  });

  return map;
}

function synthesize(text, voice, outFile) {
  // Neural engine = the natural, human-sounding voice.
  execFileSync(AWS, [
    'polly', 'synthesize-speech',
    '--engine', 'neural',
    '--voice-id', voice,
    '--language-code', 'ja-JP',
    '--output-format', 'mp3',
    '--text', text,
    '--region', REGION,
    outFile
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const texts = collectTexts();
  console.log('Unique clips to ensure:', texts.size, '(voice default ' + DEFAULT_VOICE + ')');

  const manifest = {};
  let made = 0, skipped = 0, failed = 0;
  const failures = [];

  let i = 0;
  for (const [text, meta] of texts) {
    i++;
    const id = sha1(text);
    const rel = 'tts/' + id + '.mp3';
    const abs = path.join(OUT_DIR, id + '.mp3');
    manifest[text] = { file: rel, voice: meta.voice };

    if (!FORCE && fs.existsSync(abs) && fs.statSync(abs).size > 0) {
      skipped++;
      continue;
    }
    try {
      synthesize(text, meta.voice, abs);
      made++;
      if (made % 50 === 0) console.log('  generated', made, '/', texts.size);
    } catch (err) {
      failed++;
      failures.push(text);
      const msg = (err.stderr && err.stderr.toString()) || err.message;
      console.warn('  FAIL', text, '-', msg.split('\n')[0]);
    }
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest));
  const bytes = fs.readdirSync(OUT_DIR).reduce(function(sum, f) {
    return sum + fs.statSync(path.join(OUT_DIR, f)).size;
  }, 0);
  console.log('\nDone. new ' + made + ', skipped ' + skipped + ', failed ' + failed +
    '. Bundle ' + Math.round(bytes / 1024) + ' KB across ' + Object.keys(manifest).length + ' clips.');
  if (failures.length) console.log('Failed texts:', failures.slice(0, 20).join('  '));
}

main();
