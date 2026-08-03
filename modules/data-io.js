/**
 * Data Export/Import Module
 * 
 * Handles exporting all user data as JSON and importing from backup files.
 * Includes schema validation and transaction-safe import.
 */

const EXPORT_VERSION = '1.0.0';

/**
 * Exports all user data as a JSON payload.
 * Includes version and timestamp for import validation.
 * 
 * @param {object} db - Database instance
 * @param {number} userId - User ID
 * @returns {object} Complete export payload
 */
function exportUserData(db, userId) {
  const user = db.prepare('SELECT username, current_level FROM users WHERE id = ?').get(userId);

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

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

  return {
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
}

/**
 * Validates the structure of an import payload.
 * Checks version, required fields, and data integrity.
 * 
 * @param {object} data - The import JSON
 * @returns {{ valid: boolean, errors: string[] }} Validation result
 */
function validateImportSchema(data) {
  const errors = [];

  if (!data) {
    errors.push('No data provided');
    return { valid: false, errors };
  }

  if (!data.version) errors.push('Missing version field');
  if (!data.exportedAt) errors.push('Missing exportedAt timestamp');
  if (!data.user || !data.user.username) errors.push('Missing user.username');
  if (!Array.isArray(data.srsState)) errors.push('srsState must be an array');
  if (!Array.isArray(data.progress)) errors.push('progress must be an array');
  if (!Array.isArray(data.achievements)) errors.push('achievements must be an array');

  // Validate SRS state entries
  if (Array.isArray(data.srsState)) {
    for (let i = 0; i < data.srsState.length; i++) {
      const entry = data.srsState[i];
      if (!entry.card_id) {
        errors.push(`srsState[${i}]: missing card_id`);
        break;
      }
      if (typeof entry.ease_factor !== 'number' || entry.ease_factor < 1.3) {
        errors.push(`srsState[${i}]: invalid ease_factor (must be >= 1.3)`);
        break;
      }
      if (typeof entry.interval !== 'number' || entry.interval < 0) {
        errors.push(`srsState[${i}]: invalid interval (must be >= 0)`);
        break;
      }
      if (!entry.next_review_date) {
        errors.push(`srsState[${i}]: missing next_review_date`);
        break;
      }
    }
  }

  // Validate progress entries
  if (Array.isArray(data.progress)) {
    const validTypes = ['reading', 'listening', 'dictation', 'vocabulary'];
    const validLevels = ['beginner', 'intermediate', 'advanced'];
    for (let i = 0; i < Math.min(data.progress.length, 5); i++) {
      const entry = data.progress[i];
      if (!validTypes.includes(entry.activity_type)) {
        errors.push(`progress[${i}]: invalid activity_type "${entry.activity_type}"`);
        break;
      }
      if (!validLevels.includes(entry.level)) {
        errors.push(`progress[${i}]: invalid level "${entry.level}"`);
        break;
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Imports user data from a validated JSON payload.
 * Wraps the entire operation in a transaction — rolls back on any error.
 * 
 * @param {object} db - Database instance
 * @param {number} userId - User ID
 * @param {object} data - Validated import payload
 * @returns {{ success: boolean, errors?: string[] }} Import result
 */
function importUserData(db, userId, data) {
  // Validate first
  const validation = validateImportSchema(data);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  try {
    const doImport = db.transaction(() => {
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
            card.interval, card.ease_factor, card.repetition_count || 0,
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
            record.exercise_id, record.score, record.duration_seconds || 0,
            record.completed_at || new Date().toISOString()
          );
        }
      }

      // Import achievements
      if (Array.isArray(data.achievements)) {
        const insertAch = db.prepare('INSERT OR IGNORE INTO achievements (user_id, achievement_key) VALUES (?, ?)');
        for (const key of data.achievements) {
          if (typeof key === 'string') {
            insertAch.run(userId, key);
          }
        }
      }

      // Import study days
      if (Array.isArray(data.studyDays)) {
        const insertDay = db.prepare('INSERT OR IGNORE INTO study_days (user_id, study_date, total_seconds) VALUES (?, ?, ?)');
        for (const day of data.studyDays) {
          insertDay.run(userId, day.study_date, day.total_seconds || 0);
        }
      }

      // Import settings
      if (data.settings) {
        db.prepare('DELETE FROM settings WHERE user_id = ?').run(userId);
        db.prepare(`
          INSERT INTO settings (user_id, new_cards_per_day, session_duration_target, theme, furigana_default)
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

    doImport();
    db.save(); // Persist to disk

    return { success: true };
  } catch (err) {
    return { success: false, errors: [err.message] };
  }
}

module.exports = {
  exportUserData,
  importUserData,
  validateImportSchema,
  EXPORT_VERSION
};
