/**
 * One-time migration: the previous audio bundle stored a single clip per text
 * (<sha1>.mp3) in whichever voice it happened to use. The new dual-voice scheme
 * uses <sha1>-m.mp3 (Takumi) and <sha1>-f.mp3 (Kazuha).
 *
 * This copies each existing clip to its correct voiced filename based on the old
 * manifest's `voice` field, so build-audio.js only needs to synthesize the OTHER
 * voice for each text (about half the work).
 *
 *   node scripts/migrate-audio-voices.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const CONTENT = path.join(__dirname, '..', 'content');
const TTS = path.join(CONTENT, 'audio', 'tts');
const MANIFEST = path.join(CONTENT, 'audio', 'manifest.json');

if (!fs.existsSync(MANIFEST)) { console.log('No manifest to migrate.'); process.exit(0); }
const man = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

let copied = 0, alreadyDual = 0, missing = 0;
Object.keys(man).forEach(function(text) {
  const e = man[text];
  // Already migrated (has m/f) -> skip
  if (e && (e.m || e.f) && !e.file) { alreadyDual++; return; }
  if (!e || !e.file) { missing++; return; }
  const id = path.basename(e.file, '.mp3');           // sha1
  const src = path.join(TTS, id + '.mp3');
  if (!fs.existsSync(src)) { missing++; return; }
  const k = (e.voice === 'Takumi') ? 'm' : 'f';        // old files: Takumi=male else female
  const dst = path.join(TTS, id + '-' + k + '.mp3');
  if (!fs.existsSync(dst)) { fs.copyFileSync(src, dst); copied++; }
});

console.log('Migration: copied ' + copied + ', already-dual ' + alreadyDual + ', missing ' + missing);
console.log('Next: run  node scripts/build-audio.js  to fill the missing voice, then delete old unsuffixed files.');
