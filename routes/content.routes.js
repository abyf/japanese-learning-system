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
  listVocabularyExercises, getVocabularyExercise,
  getKana, getDeepDive, getGrammar, getGuide, getDrill, getShadowing, getExam
} = require('../modules/content');
const { recordCompletion } = require('../modules/progress');
const { updateDifficultyScore } = require('../modules/adaptive');
const { compareDictation } = require('../modules/dictation-compare');
const { getTranslation, getAvailableLanguages } = require('../modules/translations');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Kana Endpoints (in-app Hiragana / Katakana learning)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/kana/:script
 * Returns hiragana or katakana learning data (chart, mnemonics, examples).
 */
router.get('/kana/:script', (req, res) => {
  const { script } = req.params;
  const data = getKana(script);
  if (!data) {
    return res.status(404).json({ error: `Kana script not found: ${script}` });
  }
  res.json(data);
});

/**
 * GET /api/deepdive/:topic
 * Returns a single deep-dive topic (onomatopoeia, collocations, idioms).
 */
router.get('/deepdive/:topic', (req, res) => {
  const { topic } = req.params;
  const data = getDeepDive(topic);
  if (!data) {
    return res.status(404).json({ error: `Deep-dive topic not found: ${topic}` });
  }
  res.json(data);
});

/**
 * GET /api/grammar/:level        → all grammar points for a level
 * GET /api/grammar/:level/:id     → a single grammar point
 */
router.get('/grammar/:level/:id', (req, res) => {
  const { level, id } = req.params;
  const data = getGrammar(level, id);
  if (!data) return res.status(404).json({ error: `Grammar point not found: ${level}/${id}` });
  res.json(data);
});

router.get('/grammar/:level', (req, res) => {
  const { level } = req.params;
  const data = getGrammar(level);
  if (!data) return res.status(404).json({ error: `Grammar not found for level: ${level}` });
  res.json({ level, points: data });
});

/**
 * GET /api/guide/:id
 * Returns a reference guide (e.g., 'numbers') with sections.
 */
router.get('/guide/:id', (req, res) => {
  const data = getGuide(req.params.id);
  if (!data) return res.status(404).json({ error: `Guide not found: ${req.params.id}` });
  res.json(data);
});

/**
 * GET /api/drill/:topic
 * Returns a sentence-building / conjugation drill topic.
 */
router.get('/drill/:topic', (req, res) => {
  const data = getDrill(req.params.topic);
  if (!data) return res.status(404).json({ error: `Drill not found: ${req.params.topic}` });
  // Attach the list of sibling topics for in-page navigation
  const all = getDrill();
  if (all && all.topics) {
    data.topics = Object.keys(all.topics).map(function(k) { return { id: k, title: all.topics[k].title }; });
  }
  res.json(data);
});

/**
 * GET /api/shadowing/:topic
 * Returns a shadowing (speaking practice) topic with sibling list.
 */
router.get('/shadowing/:topic', (req, res) => {
  const data = getShadowing(req.params.topic);
  if (!data) return res.status(404).json({ error: `Shadowing topic not found: ${req.params.topic}` });
  const all = getShadowing();
  if (all && all.topics) {
    data.topics = Object.keys(all.topics).map(function(k) { return { id: k, title: all.topics[k].title }; });
  }
  res.json(data);
});

/**
 * GET /api/exam/:id
 * Returns an exam ('placement' or 'n5-mock').
 */
router.get('/exam/:id', (req, res) => {
  const data = getExam(req.params.id);
  if (!data) return res.status(404).json({ error: `Exam not found: ${req.params.id}` });
  res.json(data);
});

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
 * Injects translations from language files when available.
 */
router.get('/reading/:level/:id', (req, res) => {
  const { level, id } = req.params;
  const passage = getPassage(level, id);

  if (passage.error) {
    return res.status(404).json(passage);
  }

  // Inject translations from language files into passage.translation
  const translations = require('../modules/translations');
  const availableLangs = translations.getAvailableLanguages();
  if (!passage.translation) passage.translation = {};
  
  availableLangs.forEach(lang => {
    if (!passage.translation[lang]) {
      const langData = translations.loadTranslationFile(lang);
      if (langData && langData.passages && langData.passages[id] && langData.passages[id].translation) {
        passage.translation[lang] = langData.passages[id].translation;
      }
    }
  });

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
 * Supports ?lang= query param for translated titles.
 */
router.get('/vocab-exercises/:level', (req, res) => {
  const { level } = req.params;
  const lang = req.query.lang || 'en';
  const db = req.app.locals.db;
  const userId = req.user.userId;
  const exercises = listVocabularyExercises(level);

  const completedExercises = db.prepare(
    "SELECT DISTINCT exercise_id FROM progress WHERE user_id = ? AND activity_type = 'vocabulary' AND level = ? AND score = 1.0"
  ).all(userId, level);
  const completedSet = new Set(completedExercises.map(r => r.exercise_id));

  // Load translations for requested language
  const translations = require('../modules/translations');
  const langTranslations = translations.loadTranslationFile(lang);

  const exercisesWithStatus = exercises.map(e => {
    var title = e.title;
    // Use translated title if available (check titles.vocabulary first, then vocabulary for backward compat)
    if (lang !== 'en' && langTranslations) {
      if (langTranslations.titles && langTranslations.titles.vocabulary && langTranslations.titles.vocabulary[e.id]) {
        title = langTranslations.titles.vocabulary[e.id];
      } else if (langTranslations.vocabulary && langTranslations.vocabulary[e.id] && langTranslations.vocabulary[e.id].title) {
        title = langTranslations.vocabulary[e.id].title;
      }
    }
    if (lang === 'fr' && title === e.title && e.titleFr) {
      title = e.titleFr;
    }
    return {
      ...e,
      title: title,
      completed: completedSet.has(e.id)
    };
  });

  res.json({ level, exercises: exercisesWithStatus });
});

/**
 * GET /api/vocab-exercises/:level/:id
 * Get a specific vocabulary exercise.
 * Supports ?lang= query param for translated title and prompts.
 */
router.get('/vocab-exercises/:level/:id', (req, res) => {
  const { level, id } = req.params;
  const lang = req.query.lang || 'en';
  const exercise = getVocabularyExercise(level, id);

  if (exercise.error) {
    return res.status(404).json(exercise);
  }

  // Apply translated title and questions if available
  if (lang !== 'en') {
    const translations = require('../modules/translations');
    const langTranslations = translations.loadTranslationFile(lang);
    if (langTranslations) {
      // Translate title
      if (langTranslations.titles && langTranslations.titles.vocabulary && langTranslations.titles.vocabulary[id]) {
        exercise.title = langTranslations.titles.vocabulary[id];
      } else if (langTranslations.vocabulary && langTranslations.vocabulary[id] && langTranslations.vocabulary[id].title) {
        exercise.title = langTranslations.vocabulary[id].title;
      }
      // Translate question prompts/options/sentences from translation file
      if (langTranslations.vocabulary && langTranslations.vocabulary[id] && langTranslations.vocabulary[id].questions) {
        const qTranslations = langTranslations.vocabulary[id].questions;
        if (exercise.questions) {
          exercise.questions.forEach((q, idx) => {
            const qKey = q.id || ('q' + (idx + 1));
            const qt = qTranslations[qKey];
            if (qt) {
              if (qt.prompt) q['prompt_' + lang] = qt.prompt;
              if (qt.sentence) q['sentence_' + lang] = qt.sentence;
              if (qt.options) q['options_' + lang] = qt.options;
            }
          });
        }
      }
    }
    if (lang === 'fr' && exercise.titleFr) {
      exercise.title = exercise.titleFr;
    }
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

// ─────────────────────────────────────────────────────────────────────────────
// Translation Endpoints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/translation/:lang/:type/:id
 * Get translated content for a specific exercise in the requested language.
 * 
 * :lang - Language code (e.g., 'pt', 'fr')
 * :type - Content type: 'passage' or 'vocabulary'
 * :id   - Content identifier (e.g., 'r001', 'v005')
 * 
 * Returns the translation object or 404 if not available.
 */
router.get('/translation/:lang/:type/:id', (req, res) => {
  const { lang, type, id } = req.params;

  // Validate type parameter
  const validTypes = ['passage', 'vocabulary'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid type: ${type}. Must be one of: ${validTypes.join(', ')}` });
  }

  const translation = getTranslation(lang, type, id);

  if (!translation) {
    return res.status(404).json({
      error: `Translation not found for ${type}/${id} in language: ${lang}`
    });
  }

  res.json({
    language: lang,
    type: type,
    id: id,
    translation: translation
  });
});

/**
 * GET /api/translation/languages
 * Get list of available content translation languages.
 */
router.get('/translation/languages', (req, res) => {
  const languages = getAvailableLanguages();
  res.json({ languages });
});

module.exports = router;
