/**
 * Settings & Data Routes
 * 
 * Handles user settings (theme, preferences) and data export/import.
 */

const express = require('express');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Settings Endpoints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/settings
 * Get the current user's settings.
 */
router.get('/settings', (req, res) => {
  const db = req.app.locals.db;
  const userId = req.user.userId;

  let settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);

  if (!settings) {
    // Create default settings
    db.prepare(`
      INSERT OR IGNORE INTO settings (user_id, new_cards_per_day, session_duration_target, theme, furigana_default, language)
      VALUES (?, 10, 25, 'light', 1, 'en')
    `).run(userId);
    settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
  }

  res.json({
    newCardsPerDay: settings.new_cards_per_day,
    sessionDurationTarget: settings.session_duration_target,
    theme: settings.theme,
    furiganaDefault: settings.furigana_default === 1,
    language: settings.language || 'en'
  });
});

/**
 * PUT /api/settings
 * Update the current user's settings.
 * Body: { newCardsPerDay?, sessionDurationTarget?, theme?, furiganaDefault? }
 */
router.put('/settings', (req, res) => {
  const db = req.app.locals.db;
  const userId = req.user.userId;
  const { newCardsPerDay, sessionDurationTarget, theme, furiganaDefault, language } = req.body;

  // Ensure settings row exists
  const existing = db.prepare('SELECT user_id FROM settings WHERE user_id = ?').get(userId);
  if (!existing) {
    db.prepare(`
      INSERT OR IGNORE INTO settings (user_id, new_cards_per_day, session_duration_target, theme, furigana_default, language)
      VALUES (?, 10, 25, 'light', 1, 'en')
    `).run(userId);
  }

  // Update only provided fields
  if (newCardsPerDay !== undefined) {
    const val = Math.max(1, Math.min(50, parseInt(newCardsPerDay, 10) || 10));
    db.prepare('UPDATE settings SET new_cards_per_day = ? WHERE user_id = ?').run(val, userId);
  }
  if (sessionDurationTarget !== undefined) {
    const val = Math.max(5, Math.min(120, parseInt(sessionDurationTarget, 10) || 25));
    db.prepare('UPDATE settings SET session_duration_target = ? WHERE user_id = ?').run(val, userId);
  }
  if (theme !== undefined) {
    const val = (theme === 'dark') ? 'dark' : 'light';
    db.prepare('UPDATE settings SET theme = ? WHERE user_id = ?').run(val, userId);
    // Also update user table
    db.prepare('UPDATE users SET theme = ? WHERE id = ?').run(val, userId);
  }
  if (furiganaDefault !== undefined) {
    const val = furiganaDefault ? 1 : 0;
    db.prepare('UPDATE settings SET furigana_default = ? WHERE user_id = ?').run(val, userId);
  }
  if (language !== undefined) {
    const val = (language === 'fr') ? 'fr' : 'en';
    db.prepare('UPDATE settings SET language = ? WHERE user_id = ?').run(val, userId);
  }

  // Return updated settings
  const updated = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
  res.json({
    newCardsPerDay: updated.new_cards_per_day,
    sessionDurationTarget: updated.session_duration_target,
    theme: updated.theme,
    furiganaDefault: updated.furigana_default === 1,
    language: updated.language || 'en'
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Export/Import Endpoints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Export format version.
 */
const EXPORT_VERSION = '1.0.0';

/**
 * GET /api/export
 * Export all user data as JSON.
 */
router.get('/export', (req, res) => {
  const db = req.app.locals.db;
  const userId = req.user.userId;

  const user = db.prepare('SELECT username, current_level FROM users WHERE id = ?').get(userId);
  const srsState = db.prepare(
    'SELECT card_id, level, interval, ease_factor, repetition_count, next_review_date, times_reviewed, times_correct, times_incorrect, current_streak FROM srs_state WHERE user_id = ?'
  ).all(userId);
  const progress = db.prepare(
    'SELECT activity_type, level, exercise_id, score, duration_seconds, completed_at FROM progress WHERE user_id = ?'
  ).all(userId);
  const achievements = db.prepare(
    'SELECT achievement_key, earned_at FROM achievements WHERE user_id = ?'
  ).all(userId);
  const settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
  const studyDays = db.prepare(
    'SELECT study_date, total_seconds FROM study_days WHERE user_id = ?'
  ).all(userId);

  const exportData = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    user: { username: user.username, currentLevel: user.current_level },
    srsState,
    progress,
    achievements: achievements.map(a => a.achievement_key),
    settings: settings ? {
      newCardsPerDay: settings.new_cards_per_day,
      sessionDurationTarget: settings.session_duration_target,
      theme: settings.theme,
      furiganaDefault: settings.furigana_default === 1
    } : null,
    studyDays
  };

  res.setHeader('Content-Disposition', 'attachment; filename="japanese-learning-export.json"');
  res.json(exportData);
});

/**
 * POST /api/import
 * Import user data from a previously exported JSON file.
 * Body: The exported JSON payload.
 */
router.post('/import', (req, res) => {
  const db = req.app.locals.db;
  const userId = req.user.userId;
  const data = req.body;

  // Validate schema
  const errors = validateImportSchema(data);
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Invalid import data', details: errors });
  }

  try {
    // Wrap in transaction
    const importTransaction = db.transaction(() => {
      // Clear existing user data
      db.prepare('DELETE FROM srs_state WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM progress WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM achievements WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM study_days WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM daily_plans WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM difficulty_scores WHERE user_id = ?').run(userId);

      // Update user level
      if (data.user && data.user.currentLevel) {
        db.prepare('UPDATE users SET current_level = ? WHERE id = ?').run(data.user.currentLevel, userId);
      }

      // Import SRS state
      if (Array.isArray(data.srsState)) {
        const insertSrs = db.prepare(`
          INSERT INTO srs_state (user_id, card_id, level, interval, ease_factor, repetition_count, next_review_date, times_reviewed, times_correct, times_incorrect, current_streak)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const card of data.srsState) {
          insertSrs.run(
            userId, card.card_id, card.level || 'beginner',
            card.interval, card.ease_factor, card.repetition_count,
            card.next_review_date, card.times_reviewed || 0,
            card.times_correct || 0, card.times_incorrect || 0,
            card.current_streak || 0
          );
        }
      }

      // Import progress
      if (Array.isArray(data.progress)) {
        const insertProgress = db.prepare(`
          INSERT INTO progress (user_id, activity_type, level, exercise_id, score, duration_seconds, completed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const record of data.progress) {
          insertProgress.run(
            userId, record.activity_type, record.level,
            record.exercise_id, record.score, record.duration_seconds,
            record.completed_at
          );
        }
      }

      // Import achievements
      if (Array.isArray(data.achievements)) {
        const insertAch = db.prepare('INSERT INTO achievements (user_id, achievement_key) VALUES (?, ?)');
        for (const key of data.achievements) {
          insertAch.run(userId, key);
        }
      }

      // Import study days
      if (Array.isArray(data.studyDays)) {
        const insertDay = db.prepare('INSERT INTO study_days (user_id, study_date, total_seconds) VALUES (?, ?, ?)');
        for (const day of data.studyDays) {
          insertDay.run(userId, day.study_date, day.total_seconds);
        }
      }

      // Import settings
      if (data.settings) {
        db.prepare('DELETE FROM settings WHERE user_id = ?').run(userId);
        db.prepare(`
          INSERT OR IGNORE INTO settings (user_id, new_cards_per_day, session_duration_target, theme, furigana_default)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          userId,
          data.settings.newCardsPerDay || 10,
          data.settings.sessionDurationTarget || 25,
          data.settings.theme || 'light',
          data.settings.furiganaDefault ? 1 : 0
        );
      }
    });

    importTransaction();
    db.save(); // Persist to disk

    res.json({ success: true, message: 'Data imported successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Import failed', message: err.message });
  }
});

/**
 * Validates the structure of an import payload.
 * @param {object} data - The import JSON
 * @returns {string[]} Array of error messages (empty if valid)
 */
function validateImportSchema(data) {
  const errors = [];

  if (!data) {
    errors.push('No data provided');
    return errors;
  }
  if (!data.version) errors.push('Missing version field');
  if (!data.exportedAt) errors.push('Missing exportedAt timestamp');
  if (!data.user || !data.user.username) errors.push('Missing user.username');
  if (!Array.isArray(data.srsState)) errors.push('srsState must be an array');
  if (!Array.isArray(data.progress)) errors.push('progress must be an array');
  if (!Array.isArray(data.achievements)) errors.push('achievements must be an array');

  // Validate SRS state entries
  if (Array.isArray(data.srsState)) {
    for (const entry of data.srsState) {
      if (typeof entry.ease_factor !== 'number' || entry.ease_factor < 1.3) {
        errors.push(`Invalid ease_factor for card ${entry.card_id || 'unknown'}`);
        break; // Only report first bad entry
      }
      if (typeof entry.interval !== 'number' || entry.interval < 0) {
        errors.push(`Invalid interval for card ${entry.card_id || 'unknown'}`);
        break;
      }
    }
  }

  return errors;
}

module.exports = router;
