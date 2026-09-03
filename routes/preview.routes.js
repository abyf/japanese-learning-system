/**
 * Public Preview Routes (Task 10 — "Test before paying")
 *
 * Serves ONLY the allowlisted free-sample content for the Japanese course,
 * WITHOUT authentication, so visitors can try one exercise per section before
 * subscribing. Mounted BEFORE the legacy auth gate in server.js.
 *
 * Everything else stays gated. The allowlist mirrors the is_preview rows seeded
 * in db/seed-preview.sql.
 *
 * These endpoints proxy the same content-module functions the paid endpoints
 * use, but only for the specific whitelisted references.
 */

'use strict';

const express = require('express');
const {
  getKana, getStrokes,
  getVocabularyExercise,
  getPassage,
  getListeningExercise, getListeningAudioPath,
  getDictationExercise, getDictationAudioPath,
  getGrammar,
  getTtsManifest, getTtsAudioPath
} = require('../modules/content');

const router = express.Router();

// Allowlist of preview sample IDs per type (must match the seeded preview rows).
const ALLOW = {
  kana: ['hiragana', 'katakana', 'kanji', 'kanji-n5'],
  vocab: ['v001'],
  reading: ['r001'],
  listening: ['l001'],
  dictation: ['d001'],
  grammar: ['g001']  // single grammar point (level 'beginner')
};

// For non-preview items we DON'T block — we fall through (next()) so the real
// authenticated content route downstream can handle it for paying users.

// ── Kana (hiragana / katakana / kanji) — free alphabet reference ────────────
router.get('/kana/:script', (req, res, next) => {
  const s = req.params.script;
  if (ALLOW.kana.indexOf(s) === -1) return next();
  const data = getKana(s);
  if (!data) return next();
  res.json(data);
});

// Stroke-order data is shared reference; safe to expose for preview kana.
router.get('/kana-strokes', (req, res) => {
  const data = getStrokes();
  if (!data) return res.status(404).json({ error: 'not available' });
  res.json(data);
});

// ── Vocabulary sample (v001) ────────────────────────────────────────────────
router.get('/vocab-exercises/:level/:id', (req, res, next) => {
  const { level, id } = req.params;
  if (ALLOW.vocab.indexOf(id) === -1) return next();
  const ex = getVocabularyExercise(level, id);
  if (!ex || ex.error) return next();
  res.json(ex);
});

// ── Reading sample (r001) ───────────────────────────────────────────────────
router.get('/reading/:level/:id', (req, res, next) => {
  const { level, id } = req.params;
  if (ALLOW.reading.indexOf(id) === -1) return next();
  const passage = getPassage(level, id);
  if (!passage || passage.error) return next();
  res.json(passage);
});

// ── Listening sample (l001) + audio ─────────────────────────────────────────
router.get('/listening/:level/:id', (req, res, next) => {
  const { level, id } = req.params;
  if (ALLOW.listening.indexOf(id) === -1) return next();
  const ex = getListeningExercise(level, id);
  if (!ex || ex.error) return next();
  res.json(ex);
});
router.get('/listening/:level/:id/audio', (req, res, next) => {
  const { level, id } = req.params;
  if (ALLOW.listening.indexOf(id) === -1) return next();
  const p = getListeningAudioPath(level, id);
  if (!p) return next();
  res.sendFile(p);
});

// ── Dictation sample (d001) + audio ─────────────────────────────────────────
router.get('/dictation/:level/:id', (req, res, next) => {
  const { level, id } = req.params;
  if (ALLOW.dictation.indexOf(id) === -1) return next();
  const ex = getDictationExercise(level, id);
  if (!ex || ex.error) return next();
  res.json(ex);
});
router.get('/dictation/:level/:id/audio', (req, res, next) => {
  const { level, id } = req.params;
  if (ALLOW.dictation.indexOf(id) === -1) return next();
  const p = getDictationAudioPath(level, id);
  if (!p) return next();
  res.sendFile(p);
});

// ── Grammar sample (single point g001) ──────────────────────────────────────
router.get('/grammar/:level/:id', (req, res, next) => {
  const { level, id } = req.params;
  if (ALLOW.grammar.indexOf(id) === -1) return next();
  const data = getGrammar(level, id);
  if (!data || data.error) return next();
  res.json(data);
});

// ── Pronunciation audio (bundled TTS clips) for preview playback ────────────
router.get('/audio/manifest', (req, res) => {
  res.json(getTtsManifest());
});
router.get('/audio/tts/:file', (req, res) => {
  const abs = getTtsAudioPath(req.params.file);
  if (!abs) return res.status(404).json({ error: 'not found' });
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(abs);
});

module.exports = router;
