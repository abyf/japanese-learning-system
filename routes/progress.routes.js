const express = require('express');
const {
  getAccuracy,
  getOverallAccuracy,
  checkAdvancement,
  getStreak,
  getStudyTime,
  ACTIVITY_TYPES
} = require('../modules/progress');
const { listPassages, listListeningExercises, listDictationExercises, listVocabularyExercises } = require('../modules/content');

const router = express.Router();

/**
 * GET /api/progress
 * Returns overall progress summary for the authenticated user.
 * Includes accuracy per activity type, overall accuracy per level,
 * streak, study time, and advancement status.
 */
router.get('/', (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.userId;

    // Get user's current level
    const user = db.prepare('SELECT current_level FROM users WHERE id = ?').get(userId);
    const currentLevel = user ? user.current_level : 'beginner';

    // Accuracy per activity type for current level
    const accuracyByActivity = {};
    for (const activity of ACTIVITY_TYPES) {
      accuracyByActivity[activity] = getAccuracy(db, userId, activity, currentLevel);
    }

    // Overall accuracy for current level
    const overallAccuracy = getOverallAccuracy(db, userId, currentLevel);

    // Advancement check
    const canAdvance = checkAdvancement(db, userId, currentLevel);

    // Streak
    const streak = getStreak(db, userId);

    // Study time
    const studyTime = {
      daily: getStudyTime(db, userId, 'day'),
      weekly: getStudyTime(db, userId, 'week'),
      monthly: getStudyTime(db, userId, 'month')
    };

    // Study-day history for the calendar heatmap (chronological)
    const studyDays = db.prepare(
      'SELECT study_date, total_seconds FROM study_days WHERE user_id = ? ORDER BY study_date ASC'
    ).all(userId);

    // Earned achievements
    const achievements = db.prepare(
      'SELECT achievement_key, earned_at FROM achievements WHERE user_id = ? ORDER BY earned_at DESC'
    ).all(userId);

    // Experience points derived from existing activity (no schema change needed):
    //   completed exercises + spaced-repetition reviews + achievement bonuses.
    const completionCount = db.prepare(
      'SELECT COUNT(*) AS c FROM progress WHERE user_id = ?'
    ).get(userId).c;
    const reviewCount = db.prepare(
      'SELECT COALESCE(SUM(times_reviewed), 0) AS c FROM srs_state WHERE user_id = ?'
    ).get(userId).c;
    const xp = completionCount * 10 + reviewCount * 2 + achievements.length * 50;
    const xpLevel = Math.floor(xp / 500) + 1;
    const xpIntoLevel = xp % 500;

    res.json({
      currentLevel,
      overallAccuracy,
      accuracyByActivity,
      canAdvance,
      streak,
      studyTime,
      studyDays,
      achievements,
      xp,
      xpLevel,
      xpIntoLevel,
      xpForNextLevel: 500,
      completionByLevel: getCompletionByLevel(db, userId)
    });
  } catch (err) {
    console.error('Progress error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve progress data' });
  }
});

/**
 * GET /api/progress/:activityType
 * Returns progress stats for a specific activity type.
 * Includes accuracy per level for the given activity.
 */
router.get('/:activityType', (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.userId;
    const { activityType } = req.params;

    if (!ACTIVITY_TYPES.includes(activityType)) {
      return res.status(400).json({
        error: `Invalid activity type. Must be one of: ${ACTIVITY_TYPES.join(', ')}`
      });
    }

    const levels = ['beginner', 'intermediate', 'advanced'];
    const accuracyByLevel = {};

    for (const level of levels) {
      accuracyByLevel[level] = getAccuracy(db, userId, activityType, level);
    }

    // Get total completions for this activity
    const totalCompletions = db.prepare(
      'SELECT COUNT(*) as count FROM progress WHERE user_id = ? AND activity_type = ?'
    ).get(userId, activityType).count;

    // Get recent records
    const recentRecords = db.prepare(`
      SELECT activity_type, level, score, duration_seconds, completed_at
      FROM progress
      WHERE user_id = ? AND activity_type = ?
      ORDER BY completed_at DESC
      LIMIT 10
    `).all(userId, activityType);

    res.json({
      activityType,
      accuracyByLevel,
      totalCompletions,
      recentRecords
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve activity progress' });
  }
});

/**
 * Achievements router - mounted at /api/achievements
 */
const achievementsRouter = express.Router();

/**
 * GET /api/achievements
 * Returns all earned achievements for the authenticated user.
 */
achievementsRouter.get('/', (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.userId;

    const achievements = db.prepare(`
      SELECT achievement_key, earned_at
      FROM achievements
      WHERE user_id = ?
      ORDER BY earned_at DESC
    `).all(userId);

    res.json({ achievements, count: achievements.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve achievements' });
  }
});

/**
 * Calculates completion percentage per level per activity.
 * An exercise is "completed" if the user scored 1.0 (100%) on it.
 */
function getCompletionByLevel(db, userId) {
  const levels = ['beginner', 'intermediate', 'advanced'];
  const result = {};

  for (const level of levels) {
    // Get actual exercise IDs from content
    const readingPassages = listPassages(level);
    const listeningExercises = listListeningExercises(level);
    const dictationExercises = listDictationExercises(level);
    const vocabularyExercises = listVocabularyExercises(level);

    const readingIds = readingPassages.map(p => p.id);
    const listeningIds = listeningExercises.map(e => e.id);
    const dictationIds = dictationExercises.map(e => e.id);
    const vocabularyIds = vocabularyExercises.map(e => e.id);

    // Count completed (score = 1.0) only for valid exercise IDs
    let readingCompleted = 0;
    let listeningCompleted = 0;
    let dictationCompleted = 0;
    let vocabularyCompleted = 0;

    if (readingIds.length > 0) {
      const placeholders = readingIds.map(() => '?').join(',');
      readingCompleted = db.prepare(
        `SELECT COUNT(DISTINCT exercise_id) as count FROM progress WHERE user_id = ? AND activity_type = 'reading' AND level = ? AND score = 1.0 AND exercise_id IN (${placeholders})`
      ).get(userId, level, ...readingIds).count;
    }

    if (listeningIds.length > 0) {
      const placeholders = listeningIds.map(() => '?').join(',');
      listeningCompleted = db.prepare(
        `SELECT COUNT(DISTINCT exercise_id) as count FROM progress WHERE user_id = ? AND activity_type = 'listening' AND level = ? AND score = 1.0 AND exercise_id IN (${placeholders})`
      ).get(userId, level, ...listeningIds).count;
    }

    if (dictationIds.length > 0) {
      const placeholders = dictationIds.map(() => '?').join(',');
      dictationCompleted = db.prepare(
        `SELECT COUNT(DISTINCT exercise_id) as count FROM progress WHERE user_id = ? AND activity_type = 'dictation' AND level = ? AND score = 1.0 AND exercise_id IN (${placeholders})`
      ).get(userId, level, ...dictationIds).count;
    }

    if (vocabularyIds.length > 0) {
      const placeholders = vocabularyIds.map(() => '?').join(',');
      vocabularyCompleted = db.prepare(
        `SELECT COUNT(DISTINCT exercise_id) as count FROM progress WHERE user_id = ? AND activity_type = 'vocabulary' AND level = ? AND score = 1.0 AND exercise_id IN (${placeholders})`
      ).get(userId, level, ...vocabularyIds).count;
    }

    result[level] = {
      reading: readingIds.length > 0 ? Math.round((readingCompleted / readingIds.length) * 100) : 0,
      listening: listeningIds.length > 0 ? Math.round((listeningCompleted / listeningIds.length) * 100) : 0,
      dictation: dictationIds.length > 0 ? Math.round((dictationCompleted / dictationIds.length) * 100) : 0,
      vocabulary: vocabularyIds.length > 0 ? Math.round((vocabularyCompleted / vocabularyIds.length) * 100) : 0
    };
  }

  return result;
}

module.exports = { progressRouter: router, achievementsRouter };
