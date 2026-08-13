/**
 * Content Translation Loader Module
 * 
 * Loads and serves translated content for reading passages and vocabulary exercises.
 * Translations are stored per-language in content/translations/{lang}.json.
 * 
 * Supports on-demand loading with in-memory caching.
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');

/**
 * In-memory cache for loaded translation files.
 * Keyed by language code.
 */
const translationCache = {};

/**
 * Load a translation file for a given language.
 * Returns cached version if already loaded.
 * 
 * @param {string} lang - Language code (e.g., 'pt', 'fr')
 * @returns {object|null} Parsed translation object or null if not found
 */
function loadTranslationFile(lang) {
  if (translationCache[lang] !== undefined) {
    return translationCache[lang];
  }

  const filePath = path.join(config.contentPath, 'translations', `${lang}.json`);
  
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      translationCache[lang] = JSON.parse(raw);
    } catch (err) {
      console.error(`Error loading translation file for ${lang}:`, err.message);
      translationCache[lang] = null;
    }
  } else {
    translationCache[lang] = null;
  }

  return translationCache[lang];
}

/**
 * Get translation for a specific content item.
 * 
 * @param {string} lang - Target language code (e.g., 'pt')
 * @param {string} type - Content type: 'passage' or 'vocabulary'
 * @param {string} id - Content identifier (e.g., 'r001', 'v005')
 * @returns {object|null} Translation object for the item, or null if not found
 */
function getTranslation(lang, type, id) {
  const translations = loadTranslationFile(lang);

  if (!translations) return null;

  if (type === 'passage' && translations.passages) {
    return translations.passages[id] || null;
  }
  if (type === 'vocabulary' && translations.vocabulary) {
    return translations.vocabulary[id] || null;
  }
  return null;
}

/**
 * Get all available translation languages.
 * Scans the translations directory for JSON files.
 * 
 * @returns {string[]} Array of available language codes
 */
function getAvailableLanguages() {
  const translationsDir = path.join(config.contentPath, 'translations');
  
  if (!fs.existsSync(translationsDir)) {
    return [];
  }

  return fs.readdirSync(translationsDir)
    .filter(f => f.endsWith('.json'))
    .map(f => path.basename(f, '.json'));
}

/**
 * Clear the translation cache (useful for hot-reloading in development).
 */
function clearCache() {
  Object.keys(translationCache).forEach(key => {
    delete translationCache[key];
  });
}

module.exports = {
  getTranslation,
  getAvailableLanguages,
  loadTranslationFile,
  clearCache
};
