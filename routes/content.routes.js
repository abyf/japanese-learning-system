/**
 * Content Routes
 * 
 * Serves all learning content: reading passages, listening exercises,
 * dictation exercises, dictionary lookups, kanji strokes, and vocabulary audio.
 * Includes POST endpoints for submitting exercise answers.
 */

const express = require('express');
const path = require('path');
const {
  getPassage, listPassages,
  getListeningExercise, listListeningExercises, getListeningAudioPath,
  getDictationExercise, listDictationExercises, getDictationAudioPath,
  lookupWord,
  getKanjiStrokes,
  getVocabulary, getVocabularyItem, getVocabularyAudioPath,
  listVocabularyExercises, getVocabularyExercise
} = require('../modules/content');
const { recordCompletion } = require('../modules/progress');
const { updateDifficultyScore } = require('../modules/adaptive');
const { compareDictation } = require('../modules/dictation-compare');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Reading Endpoints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/reading/:level
 * List all reading passages for a given level.
 */
router.get('/reading/:level', (req, res) => {
  const { level } = req.params;
  const db = req.app.locals.db;
  const userId = req.user.userId;
  const passages = listPassages(level);

  // Get completion status for each passage
  const completedExercises = db.prepare(
    "SELECT DISTINCT exercise_id FROM progress WHERE user_id = ? AND activity_type = 'reading' AND level = ? AND score = 1.0"
  ).all(userId, level);
  const completedSet = new Set(completedExercises.map(r => r.exercise_id));

  const passagesWithStatus = passages.map(p => ({
    ...p,
    completed: completedSet.has(p.id)
  }));

  res.json({ level, passages: passagesWithStatus });
});

/**
 * GET /api/reading/:level/:id
 * Get a specific reading passage with text, furigana data, and questions.
 */
router.get('/reading/:level/:id', (req, res) => {
  const { level, id } = req.params;
  const passage = getPassage(level, id);

  if (passage.error) {
    return res.status(404).json(passage);
  }

  res.json(passage);
});

/**
 * POST /api/reading/:level/:id/submit
 * Submit comprehension answers for a reading passage.
 * Body: { answers: [{ questionId, answer }] }
 */
router.post('/reading/:level/:id/submit', (req, res) => {
  const { level, id } = req.params;
  const { answers } = req.body;
  const db = req.app.locals.db;
  const userId = req.user.userId;

  if (!answers || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'answers array is required' });
  }

  const passage = getPassage(level, id);
  if (passage.error) {
    return res.status(404).json(passage);
  }

  // Score: count correct answers / total questions
  const questions = passage.questions || [];
  let correct = 0;

  const results = questions.map((question, idx) => {
    // Frontend sends answers as array of strings (selected option index)
    const userAnswer = answers[idx] !== undefined ? String(answers[idx]) : '';
    
    // The correctAnswer in the JSON is the actual text (e.g., "5人")
    // The frontend sends the option index (e.g., "2" for third option)
    // We need to compare: options[userAnswer] === correctAnswer
    const correctAnswer = question.correctAnswer;
    const options = question.options || [];
    let isCorrect = false;
    
    // Try matching by index first (frontend sends index as string)
    const selectedIndex = parseInt(userAnswer, 10);
    if (!isNaN(selectedIndex) && selectedIndex >= 0 && selectedIndex < options.length) {
      isCorrect = options[selectedIndex] === correctAnswer;
    } else {
      // Fallback: direct text comparison
      isCorrect = userAnswer === correctAnswer;
    }
    
    if (isCorrect) correct++;
    
    return {
      questionId: question.id || ('q' + idx),
      userAnswer: userAnswer,
      selectedText: options[selectedIndex] || userAnswer,
      correct: isCorrect,
      correctAnswer: correctAnswer
    };
  });

  const score = questions.length > 0 ? correct / questions.length : 0;
  const duration = req.body.duration || 0;

  // Record progress (wrapped in try-catch to avoid 500s)
  try {
    recordCompletion(db, userId, 'reading', level, score, duration, id);
    updateDifficultyScore(db, userId, 'reading', score >= 0.5);
    db.save(); // Persist to disk immediately
  } catch (err) {
    console.error('Error recording progress:', err.message);
  }

  const isCompleted = score === 1.0;

  res.json({
    score,
    correct,
    total: questions.length,
    results,
    correctAnswers: results.map(r => r.correctAnswer),
    completed: isCompleted
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Listening Endpoints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/listening/:level
 * List all listening exercises for a given level.
 */
router.get('/listening/:level', (req, res) => {
  const { level } = req.params;
  const db = req.app.locals.db;
  const userId = req.user.userId;
  const exercises = listListeningExercises(level);

  const completedExercises = db.prepare(
    "SELECT DISTINCT exercise_id FROM progress WHERE user_id = ? AND activity_type = 'listening' AND level = ? AND score = 1.0"
  ).all(userId, level);
  const completedSet = new Set(completedExercises.map(r => r.exercise_id));

  const exercisesWithStatus = exercises.map(e => ({
    ...e,
    completed: completedSet.has(e.id)
  }));

  res.json({ level, exercises: exercisesWithStatus });
});

/**
 * GET /api/listening/:level/:id
 * Get a specific listening exercise metadata.
 */
router.get('/listening/:level/:id', (req, res) => {
  const { level, id } = req.params;
  const exercise = getListeningExercise(level, id);

  if (exercise.error) {
    return res.status(404).json(exercise);
  }

  res.json(exercise);
});

/**
 * GET /api/listening/:level/:id/audio
 * Stream the audio file for a listening exercise.
 */
router.get('/listening/:level/:id/audio', (req, res) => {
  const { level, id } = req.params;
  const audioPath = getListeningAudioPath(level, id);

  if (!audioPath) {
    return res.status(404).json({ error: `Audio not found for: ${level}/${id}` });
  }

  res.sendFile(audioPath);
});

/**
 * POST /api/listening/:level/:id/submit
 * Submit an answer for a listening exercise.
 * Body: { answer: string | string[], duration: number }
 */
router.post('/listening/:level/:id/submit', (req, res) => {
  const { level, id } = req.params;
  const { answer, duration } = req.body;
  const db = req.app.locals.db;
  const userId = req.user.userId;

  if (answer === undefined || answer === null) {
    return res.status(400).json({ error: 'answer is required' });
  }

  const exercise = getListeningExercise(level, id);
  if (exercise.error) {
    return res.status(404).json(exercise);
  }

  // Handle questions array format
  const questions = exercise.questions || [];
  let correctCount = 0;
  
  // If answers is an array (one per question), compare each
  const answerList = Array.isArray(answer) ? answer : [answer];
  
  const results = questions.map((question, idx) => {
    const userAnswer = answerList[idx] !== undefined ? String(answerList[idx]) : '';
    const correctAnswer = question.correctAnswer;
    const options = question.options || [];
    let isCorrect = false;
    
    // correctAnswer can be a number (index) or string (text)
    if (typeof correctAnswer === 'number') {
      isCorrect = parseInt(userAnswer, 10) === correctAnswer;
    } else {
      // Try index match first
      const selectedIdx = parseInt(userAnswer, 10);
      if (!isNaN(selectedIdx) && selectedIdx >= 0 && selectedIdx < options.length) {
        isCorrect = options[selectedIdx] === correctAnswer;
      } else {
        isCorrect = userAnswer === correctAnswer;
      }
    }
    
    if (isCorrect) correctCount++;
    return {
      correct: isCorrect,
      correctAnswer: typeof correctAnswer === 'number' ? options[correctAnswer] : correctAnswer
    };
  });

  const total = questions.length || 1;
  const score = total > 0 ? correctCount / total : 0;

  // Record progress
  try {
    recordCompletion(db, userId, 'listening', level, score, duration || 0, id);
    updateDifficultyScore(db, userId, 'listening', score >= 0.5);
    db.save(); // Persist to disk immediately
  } catch (err) {
    console.error('Error recording listening progress:', err.message);
  }

  const isCompleted = score === 1.0;

  res.json({
    correct: correctCount,
    total: total,
    score,
    results,
    transcript: exercise.transcript || null,
    completed: isCompleted
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Dictation Endpoints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/dictation/:level
 * List all dictation exercises for a given level.
 */
router.get('/dictation/:level', (req, res) => {
  const { level } = req.params;
  const db = req.app.locals.db;
  const userId = req.user.userId;
  const exercises = listDictationExercises(level);

  const completedExercises = db.prepare(
    "SELECT DISTINCT exercise_id FROM progress WHERE user_id = ? AND activity_type = 'dictation' AND level = ? AND score = 1.0"
  ).all(userId, level);
  const completedSet = new Set(completedExercises.map(r => r.exercise_id));

  const exercisesWithStatus = exercises.map(e => ({
    ...e,
    completed: completedSet.has(e.id)
  }));

  res.json({ level, exercises: exercisesWithStatus });
});

/**
 * GET /api/dictation/:level/:id
 * Get a dictation exercise (metadata + audio path, expected text withheld).
 */
router.get('/dictation/:level/:id', (req, res) => {
  const { level, id } = req.params;
  const exercise = getDictationExercise(level, id);

  if (exercise.error) {
    return res.status(404).json(exercise);
  }

  // Include speechText for TTS (local app, no cheating concern)
  const { expectedText, ...metadata } = exercise;
  metadata.speechText = expectedText || '';
  res.json(metadata);
});

/**
 * GET /api/dictation/:level/:id/audio
 * Stream the audio file for a dictation exercise.
 */
router.get('/dictation/:level/:id/audio', (req, res) => {
  const { level, id } = req.params;
  const audioPath = getDictationAudioPath(level, id);

  if (!audioPath) {
    return res.status(404).json({ error: `Audio not found for: ${level}/${id}` });
  }

  res.sendFile(audioPath);
});

/**
 * POST /api/dictation/:level/:id/submit
 * Submit a dictation attempt.
 * Body: { attempt: string, duration: number }
 * Returns character-level diff and accuracy.
 */
router.post('/dictation/:level/:id/submit', (req, res) => {
  const { level, id } = req.params;
  const { attempt, duration } = req.body;
  const db = req.app.locals.db;
  const userId = req.user.userId;

  if (!attempt && attempt !== '') {
    return res.status(400).json({ error: 'attempt is required' });
  }

  const exercise = getDictationExercise(level, id);
  if (exercise.error) {
    return res.status(404).json(exercise);
  }

  const expected = exercise.expectedText || '';

  // Character-level comparison using LCS algorithm
  const result = compareDictation(expected, attempt);
  const accuracy = result.accuracy;

  // Record progress
  try {
    recordCompletion(db, userId, 'dictation', level, accuracy, duration || 0, id);
    updateDifficultyScore(db, userId, 'dictation', accuracy >= 0.5);
    db.save(); // Persist to disk immediately
  } catch (err) {
    console.error('Error recording dictation progress:', err.message);
  }

  const isCompleted = accuracy === 1.0;

  res.json({
    accuracy,
    expected,
    attempt,
    charDiffs: result.charDiffs,
    correct: accuracy >= 0.8,
    completed: isCompleted
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Dictionary Endpoint
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/dictionary/lookup?q=word
 * Look up a word in the embedded JMdict dictionary.
 */
router.get('/dictionary/lookup', (req, res) => {
  const { q } = req.query;

  if (!q || q.trim().length === 0) {
    return res.status(400).json({ error: 'Query parameter q is required' });
  }

  const results = lookupWord(q);
  res.json({ query: q, results });
});

// ─────────────────────────────────────────────────────────────────────────────
// Kanji Stroke Order Endpoint
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/kanji/:char/strokes
 * Get KanjiVG stroke order SVG data for a character.
 */
router.get('/kanji/:char/strokes', (req, res) => {
  const { char } = req.params;
  const result = getKanjiStrokes(char);

  if (result.error) {
    return res.status(404).json(result);
  }

  res.json(result);
});

// ─────────────────────────────────────────────────────────────────────────────
// Vocabulary Endpoints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/vocabulary/:level
 * Get all vocabulary items for a level.
 */
router.get('/vocabulary/:level', (req, res) => {
  const { level } = req.params;
  const vocabulary = getVocabulary(level);
  res.json({ level, count: vocabulary.length, vocabulary });
});

/**
 * GET /api/vocabulary/:level/:id
 * Get a single vocabulary item.
 */
router.get('/vocabulary/:level/:id', (req, res) => {
  const { level, id } = req.params;
  const item = getVocabularyItem(level, id);

  if (!item) {
    return res.status(404).json({ error: `Vocabulary item not found: ${level}/${id}` });
  }

  res.json(item);
});

/**
 * GET /api/vocabulary/:level/:id/audio
 * Stream the pronunciation audio for a vocabulary item.
 */
router.get('/vocabulary/:level/:id/audio', (req, res) => {
  const { level, id } = req.params;
  const audioPath = getVocabularyAudioPath(level, id);

  if (!audioPath) {
    return res.status(404).json({ error: `Audio not found for vocabulary: ${level}/${id}` });
  }

  res.sendFile(audioPath);
});

// ─────────────────────────────────────────────────────────────────────────────
// Vocabulary Exercise Endpoints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/vocab-exercises/:level
 * List all vocabulary exercises for a level with completion status.
 */
router.get('/vocab-exercises/:level', (req, res) => {
  const { level } = req.params;
  const db = req.app.locals.db;
  const userId = req.user.userId;
  const exercises = listVocabularyExercises(level);

  const completedExercises = db.prepare(
    "SELECT DISTINCT exercise_id FROM progress WHERE user_id = ? AND activity_type = 'vocabulary' AND level = ? AND score = 1.0"
  ).all(userId, level);
  const completedSet = new Set(completedExercises.map(r => r.exercise_id));

  const exercisesWithStatus = exercises.map(e => ({
    ...e,
    completed: completedSet.has(e.id)
  }));

  res.json({ level, exercises: exercisesWithStatus });
});

/**
 * GET /api/vocab-exercises/:level/:id
 * Get a specific vocabulary exercise.
 */
router.get('/vocab-exercises/:level/:id', (req, res) => {
  const { level, id } = req.params;
  const exercise = getVocabularyExercise(level, id);

  if (exercise.error) {
    return res.status(404).json(exercise);
  }

  res.json(exercise);
});

/**
 * POST /api/vocab-exercises/:level/:id/submit
 * Submit answers for a vocabulary exercise.
 * Body: { answers: [string], duration: number }
 * Uses index-based comparison (same as reading submit).
 * Score = 1.0 marks as complete.
 */
router.post('/vocab-exercises/:level/:id/submit', (req, res) => {
  const { level, id } = req.params;
  const { answers, duration } = req.body;
  const db = req.app.locals.db;
  const userId = req.user.userId;

  if (!answers || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'answers array is required' });
  }

  const exercise = getVocabularyExercise(level, id);
  if (exercise.error) {
    return res.status(404).json(exercise);
  }

  const questions = exercise.questions || [];
  let correct = 0;

  const results = questions.map((question, idx) => {
    const userAnswer = answers[idx] !== undefined ? String(answers[idx]) : '';
    const correctAnswer = question.correctAnswer;
    const options = question.options || [];
    let isCorrect = false;

    // Index-based comparison: frontend sends option index as string
    const selectedIndex = parseInt(userAnswer, 10);
    if (!isNaN(selectedIndex) && selectedIndex >= 0 && selectedIndex < options.length) {
      isCorrect = options[selectedIndex] === correctAnswer;
    } else {
      // Fallback: direct text comparison
      isCorrect = userAnswer === correctAnswer;
    }

    if (isCorrect) correct++;

    return {
      questionId: question.id || ('q' + idx),
      userAnswer: userAnswer,
      selectedText: options[selectedIndex] || userAnswer,
      correct: isCorrect,
      correctAnswer: correctAnswer
    };
  });

  const score = questions.length > 0 ? correct / questions.length : 0;

  // Record progress with exercise ID
  try {
    recordCompletion(db, userId, 'vocabulary', level, score, duration || 0, id);
    updateDifficultyScore(db, userId, 'vocabulary', score >= 0.5);
    db.save();
  } catch (err) {
    console.error('Error recording vocabulary exercise progress:', err.message);
  }

  const isCompleted = score === 1.0;

  res.json({
    score,
    correct,
    total: questions.length,
    results,
    correctAnswers: results.map(r => r.correctAnswer),
    completed: isCompleted
  });
});

module.exports = router;
