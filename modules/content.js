/**
 * Content Server Module
 * 
 * Serves embedded learning materials from the content/ directory:
 * - Reading passages (JSON)
 * - Listening exercises (JSON + audio)
 * - Dictation exercises (JSON + audio)
 * - Dictionary lookups (JMdict-lite)
 * - Kanji stroke order data (KanjiVG SVG)
 * - Vocabulary data (JSON)
 * - Audio file paths
 * 
 * All content is organized by level (beginner, intermediate, advanced)
 * and loaded from the local filesystem — no network requests.
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');

/**
 * Valid levels for content filtering.
 */
const VALID_LEVELS = ['beginner', 'intermediate', 'advanced'];

/**
 * In-memory dictionary cache (loaded once on first lookup).
 */
let dictionaryCache = null;

/**
 * In-memory vocabulary cache per level.
 */
const vocabularyCache = {};

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates that a level string is one of the valid levels.
 * @param {string} level 
 * @returns {boolean}
 */
function isValidLevel(level) {
  return VALID_LEVELS.includes(level);
}

/**
 * Safely reads and parses a JSON file. Returns null if file doesn't exist or is invalid.
 * @param {string} filePath - Absolute path to JSON file
 * @returns {object|null} Parsed JSON or null
 */
function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading JSON file ${filePath}:`, err.message);
    return null;
  }
}

/**
 * Lists all JSON files in a directory and returns their parsed contents.
 * @param {string} dirPath - Directory to scan
 * @returns {Array} Array of parsed JSON objects with id derived from filename
 */
function listJsonFiles(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      return [];
    }
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
    return files.map(file => {
      const content = readJsonFile(path.join(dirPath, file));
      if (content) {
        content.id = content.id || path.basename(file, '.json');
      }
      return content;
    }).filter(Boolean);
  } catch (err) {
    console.error(`Error listing directory ${dirPath}:`, err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reading Passages
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gets a specific reading passage by level and ID.
 * 
 * @param {string} level - beginner, intermediate, or advanced
 * @param {string} passageId - Passage identifier (e.g., 'r001')
 * @returns {object|null} Passage object with text, questions, metadata or null if not found
 */
function getPassage(level, passageId) {
  if (!isValidLevel(level)) {
    return { error: `Invalid level: ${level}` };
  }

  const filePath = path.join(config.contentPath, 'passages', level, `${passageId}.json`);
  const passage = readJsonFile(filePath);

  if (!passage) {
    return { error: `Passage not found: ${level}/${passageId}` };
  }

  passage.id = passageId;
  passage.level = level;
  return passage;
}

/**
 * Lists all available reading passages for a given level.
 * 
 * @param {string} level - beginner, intermediate, or advanced
 * @returns {Array} Array of passage summaries (id, title, difficulty)
 */
function listPassages(level) {
  if (!isValidLevel(level)) {
    return [];
  }

  const dirPath = path.join(config.contentPath, 'passages', level);
  const passages = listJsonFiles(dirPath);

  return passages.map(p => ({
    id: p.id,
    title: p.title || p.id,
    difficulty: p.difficulty || 0.5,
    wordCount: p.text ? p.text.length : 0
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Listening Exercises
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gets a specific listening exercise by level and ID.
 * 
 * @param {string} level - beginner, intermediate, or advanced
 * @param {string} exerciseId - Exercise identifier (e.g., 'l001')
 * @returns {object|null} Exercise metadata (questions, type, audioPath) or null
 */
function getListeningExercise(level, exerciseId) {
  if (!isValidLevel(level)) {
    return { error: `Invalid level: ${level}` };
  }

  const filePath = path.join(config.contentPath, 'audio', 'listening', level, `${exerciseId}.json`);
  const exercise = readJsonFile(filePath);

  if (!exercise) {
    return { error: `Listening exercise not found: ${level}/${exerciseId}` };
  }

  exercise.id = exerciseId;
  exercise.level = level;
  exercise.audioPath = `/api/listening/${level}/${exerciseId}/audio`;
  return exercise;
}

/**
 * Lists all listening exercises for a level.
 * 
 * @param {string} level - beginner, intermediate, or advanced
 * @returns {Array} Array of exercise summaries
 */
function listListeningExercises(level) {
  if (!isValidLevel(level)) {
    return [];
  }

  const dirPath = path.join(config.contentPath, 'audio', 'listening', level);
  const exercises = listJsonFiles(dirPath);

  return exercises.map(e => ({
    id: e.id,
    title: e.title || e.id,
    type: e.type || 'multiple_choice',
    difficulty: e.difficulty || 0.5
  }));
}

/**
 * Gets the filesystem path to a listening exercise's audio file.
 * 
 * @param {string} level 
 * @param {string} exerciseId 
 * @returns {string|null} Absolute file path to the audio file, or null
 */
function getListeningAudioPath(level, exerciseId) {
  const mp3Path = path.join(config.contentPath, 'audio', 'listening', level, `${exerciseId}.mp3`);
  if (fs.existsSync(mp3Path)) return mp3Path;

  const oggPath = path.join(config.contentPath, 'audio', 'listening', level, `${exerciseId}.ogg`);
  if (fs.existsSync(oggPath)) return oggPath;

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dictation Exercises
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gets a specific dictation exercise by level and ID.
 * 
 * @param {string} level - beginner, intermediate, or advanced
 * @param {string} exerciseId - Exercise identifier (e.g., 'd001')
 * @returns {object|null} Exercise with expected text and audioPath
 */
function getDictationExercise(level, exerciseId) {
  if (!isValidLevel(level)) {
    return { error: `Invalid level: ${level}` };
  }

  const filePath = path.join(config.contentPath, 'audio', 'dictation', level, `${exerciseId}.json`);
  const exercise = readJsonFile(filePath);

  if (!exercise) {
    return { error: `Dictation exercise not found: ${level}/${exerciseId}` };
  }

  exercise.id = exerciseId;
  exercise.level = level;
  exercise.audioPath = `/api/dictation/${level}/${exerciseId}/audio`;
  return exercise;
}

/**
 * Lists all dictation exercises for a level.
 * 
 * @param {string} level 
 * @returns {Array} Array of exercise summaries
 */
function listDictationExercises(level) {
  if (!isValidLevel(level)) {
    return [];
  }

  const dirPath = path.join(config.contentPath, 'audio', 'dictation', level);
  const exercises = listJsonFiles(dirPath);

  return exercises.map(e => ({
    id: e.id,
    title: e.title || e.id,
    difficulty: e.difficulty || 0.5
  }));
}

/**
 * Gets the filesystem path to a dictation exercise's audio file.
 * 
 * @param {string} level 
 * @param {string} exerciseId 
 * @returns {string|null} Absolute file path to the audio file, or null
 */
function getDictationAudioPath(level, exerciseId) {
  const mp3Path = path.join(config.contentPath, 'audio', 'dictation', level, `${exerciseId}.mp3`);
  if (fs.existsSync(mp3Path)) return mp3Path;

  const oggPath = path.join(config.contentPath, 'audio', 'dictation', level, `${exerciseId}.ogg`);
  if (fs.existsSync(oggPath)) return oggPath;

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dictionary Lookup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loads the dictionary into memory on first call (lazy initialization).
 * Uses a trimmed JMdict JSON file.
 */
function loadDictionary() {
  if (dictionaryCache) return dictionaryCache;

  const dictPath = path.join(config.contentPath, 'dictionary', 'jmdict-lite.json');
  const data = readJsonFile(dictPath);

  if (!data) {
    console.warn('Dictionary file not found or invalid:', dictPath);
    dictionaryCache = [];
    return dictionaryCache;
  }

  // Expect array of entries or an object with an entries array
  dictionaryCache = Array.isArray(data) ? data : (data.entries || []);
  console.log(`Dictionary loaded: ${dictionaryCache.length} entries`);
  return dictionaryCache;
}

/**
 * Looks up a word in the embedded dictionary.
 * Searches by exact match on word field and readings.
 * 
 * @param {string} word - Japanese word to look up
 * @returns {Array} Array of matching dictionary entries
 */
function lookupWord(word) {
  if (!word || word.trim().length === 0) {
    return [];
  }

  const dictionary = loadDictionary();
  const query = word.trim();

  // Search for exact matches on word, readings, or kanji forms
  const results = dictionary.filter(entry => {
    if (entry.word === query) return true;
    if (entry.kanji === query) return true;
    if (Array.isArray(entry.readings) && entry.readings.includes(query)) return true;
    if (Array.isArray(entry.kanji_forms) && entry.kanji_forms.includes(query)) return true;
    return false;
  });

  return results.slice(0, 10); // Limit to 10 results
}

// ─────────────────────────────────────────────────────────────────────────────
// Kanji Stroke Order
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gets the SVG stroke order data for a kanji character.
 * Uses KanjiVG data stored as SVG files named by Unicode codepoint.
 * 
 * @param {string} character - Single kanji character
 * @returns {object} Object with { character, svg } or { error }
 */
function getKanjiStrokes(character) {
  if (!character || character.length === 0) {
    return { error: 'No character provided' };
  }

  // Get the first character's Unicode codepoint as hex (5 digits, zero-padded)
  const codepoint = character.codePointAt(0).toString(16).padStart(5, '0');
  const svgPath = path.join(config.contentPath, 'kanji', 'kanjivg', `${codepoint}.svg`);

  try {
    if (!fs.existsSync(svgPath)) {
      return { error: `Stroke data not found for: ${character}` };
    }
    const svg = fs.readFileSync(svgPath, 'utf-8');
    return { character, codepoint, svg };
  } catch (err) {
    return { error: `Error reading stroke data for: ${character}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Vocabulary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gets all vocabulary items for a given level.
 * Loaded from content/vocabulary/{level}.json.
 * 
 * @param {string} level - beginner, intermediate, or advanced
 * @returns {Array} Array of vocabulary card objects
 */
function getVocabulary(level) {
  if (!isValidLevel(level)) {
    return [];
  }

  if (vocabularyCache[level]) {
    return vocabularyCache[level];
  }

  const filePath = path.join(config.contentPath, 'vocabulary', `${level}.json`);
  const data = readJsonFile(filePath);

  if (!data) {
    return [];
  }

  const vocab = Array.isArray(data) ? data : (data.cards || data.vocabulary || []);
  vocabularyCache[level] = vocab;
  return vocab;
}

/**
 * Gets a single vocabulary item by ID.
 * 
 * @param {string} level - beginner, intermediate, or advanced
 * @param {string} cardId - Card identifier
 * @returns {object|null} Vocabulary card or null
 */
function getVocabularyItem(level, cardId) {
  const vocab = getVocabulary(level);
  return vocab.find(v => v.id === cardId) || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Audio Paths
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gets the filesystem path for a vocabulary pronunciation audio file.
 * 
 * @param {string} level - beginner, intermediate, or advanced
 * @param {string} vocabId - Vocabulary item ID (e.g., 'v001')
 * @returns {string|null} Absolute path to audio file, or null if not found
 */
function getVocabularyAudioPath(level, vocabId) {
  const mp3Path = path.join(config.contentPath, 'audio', 'vocabulary', level, `${vocabId}.mp3`);
  if (fs.existsSync(mp3Path)) return mp3Path;

  const oggPath = path.join(config.contentPath, 'audio', 'vocabulary', level, `${vocabId}.ogg`);
  if (fs.existsSync(oggPath)) return oggPath;

  return null;
}

/**
 * Generic audio path resolver for any content type.
 * 
 * @param {string} type - 'vocabulary', 'listening', or 'dictation'
 * @param {string} level - Level string
 * @param {string} resourceId - Resource identifier
 * @returns {string|null} Absolute file path or null
 */
function getAudioPath(type, level, resourceId) {
  switch (type) {
    case 'vocabulary':
      return getVocabularyAudioPath(level, resourceId);
    case 'listening':
      return getListeningAudioPath(level, resourceId);
    case 'dictation':
      return getDictationAudioPath(level, resourceId);
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Vocabulary Exercises
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lists all vocabulary exercises for a given level.
 * Reads from content/vocabulary-exercises/{level}/ directory.
 * 
 * @param {string} level - beginner, intermediate, or advanced
 * @returns {Array} Array of { id, title, difficulty, completed }
 */
function listVocabularyExercises(level) {
  if (!isValidLevel(level)) {
    return [];
  }

  const dirPath = path.join(config.contentPath, 'vocabulary-exercises', level);
  const exercises = listJsonFiles(dirPath);

  return exercises.map(e => ({
    id: e.id,
    title: e.title || e.titleEn || e.id,
    difficulty: e.difficulty || 0.5
  }));
}

/**
 * Gets a specific vocabulary exercise by level and ID.
 * 
 * @param {string} level - beginner, intermediate, or advanced
 * @param {string} exerciseId - Exercise identifier (e.g., 'v001')
 * @returns {object|null} Exercise object or error
 */
function getVocabularyExercise(level, exerciseId) {
  if (!isValidLevel(level)) {
    return { error: `Invalid level: ${level}` };
  }

  const filePath = path.join(config.contentPath, 'vocabulary-exercises', level, `${exerciseId}.json`);
  const exercise = readJsonFile(filePath);

  if (!exercise) {
    return { error: `Vocabulary exercise not found: ${level}/${exerciseId}` };
  }

  exercise.id = exerciseId;
  exercise.level = level;
  return exercise;
}

module.exports = {
  // Reading
  getPassage,
  listPassages,
  // Listening
  getListeningExercise,
  listListeningExercises,
  getListeningAudioPath,
  // Dictation
  getDictationExercise,
  listDictationExercises,
  getDictationAudioPath,
  // Dictionary
  lookupWord,
  loadDictionary,
  // Kanji
  getKanjiStrokes,
  // Vocabulary
  getVocabulary,
  getVocabularyItem,
  getVocabularyAudioPath,
  // Vocabulary Exercises
  listVocabularyExercises,
  getVocabularyExercise,
  // Generic
  getAudioPath,
  // Constants
  VALID_LEVELS
};
