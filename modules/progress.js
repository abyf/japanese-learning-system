/**
 * Progress Tracker Module
 * 
 * Records exercise completions, calculates accuracy per activity/level,
 * tracks streaks and study time, checks advancement thresholds,
 * and triggers achievement evaluation.
 */

/**
 * Valid activity types in the system.
 */
const ACTIVITY_TYPES = ['reading', 'listening', 'dictation', 'vocabulary'];

/**
 * Records completion of an exercise.
 * Inserts a progress record, upserts study_days for today, and checks achievements.
 * 
 * @param {object} db - better-sqlite3 database instance
 * @param {number} userId - User ID
 * @param {string} activityType - One of: reading, listening, dictation, vocabulary
 * @param {string} level - One of: beginner, intermediate, advanced
 * @param {number} score - Score between 0.0 and 1.0
 * @param {number} duration - Duration in seconds
 * @returns {object} The inserted progress record info
 */
function recordCompletion(db, userId, activityType, level, score, duration, exerciseId) {
  if (!ACTIVITY_TYPES.includes(activityType)) {
    throw new Error(`Invalid activity type: ${activityType}. Must be one of: ${ACTIVITY_TYPES.join(', ')}`);
  }

  const validLevels = ['beginner', 'intermediate', 'advanced'];
  if (!validLevels.includes(level)) {
    throw new Error(`Invalid level: ${level}. Must be one of: ${validLevels.join(', ')}`);
  }

  if (typeof score !== 'number' || score < 0 || score > 1) {
    throw new Error('Score must be a number between 0.0 and 1.0');
  }

  if (typeof duration !== 'number' || duration < 0) {
    throw new Error('Duration must be a non-negative number');
  }

  const resolvedExerciseId = exerciseId || `${activityType}_${level}_${Date.now()}`;
  const today = new Date().toISOString().split('T')[0];

  // Insert progress record
  const insertProgress = db.prepare(`
    INSERT INTO progress (user_id, activity_type, level, exercise_id, score, duration_seconds, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  insertProgress.run(userId, activityType, level, resolvedExerciseId, score, Math.round(duration));

  // Upsert study_days for today
  const upsertStudyDay = db.prepare(`
    INSERT INTO study_days (user_id, study_date, total_seconds)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, study_date)
    DO UPDATE SET total_seconds = total_seconds + ?
  `);
  upsertStudyDay.run(userId, today, Math.round(duration), Math.round(duration));

  // Check and award achievements
  _checkAchievements(db, userId);

  return {
    userId,
    activityType,
    level,
    exerciseId,
    score,
    duration: Math.round(duration)
  };
}

/**
 * Gets accuracy for a specific activity type and level.
 * Accuracy = count(score >= 0.5) / total records, or 0 if no records.
 * 
 * @param {object} db - better-sqlite3 database instance
 * @param {number} userId - User ID
 * @param {string} activityType - Activity type
 * @param {string} level - Level
 * @returns {number} Accuracy between 0.0 and 1.0
 */
function getAccuracy(db, userId, activityType, level) {
  const result = db.prepare(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN score >= 0.5 THEN 1 END) as passing
    FROM progress
    WHERE user_id = ? AND activity_type = ? AND level = ?
  `).get(userId, activityType, level);

  if (!result || result.total === 0) {
    return 0;
  }

  return result.passing / result.total;
}

/**
 * Gets overall accuracy across all 4 activity types for a given level.
 * Accuracy = count(score >= 0.5) / total records across all activities, or 0 if empty.
 * 
 * @param {object} db - better-sqlite3 database instance
 * @param {number} userId - User ID
 * @param {string} level - Level
 * @returns {number} Overall accuracy between 0.0 and 1.0
 */
function getOverallAccuracy(db, userId, level) {
  const result = db.prepare(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN score >= 0.5 THEN 1 END) as passing
    FROM progress
    WHERE user_id = ? AND level = ?
  `).get(userId, level);

  if (!result || result.total === 0) {
    return 0;
  }

  return result.passing / result.total;
}

/**
 * Checks if a user qualifies for level advancement.
 * Returns true if overallAccuracy >= 0.8 for the given level.
 * 
 * @param {object} db - better-sqlite3 database instance
 * @param {number} userId - User ID
 * @param {string} level - Current level to check
 * @returns {boolean} True if user can advance from this level
 */
function checkAdvancement(db, userId, level) {
  const accuracy = getOverallAccuracy(db, userId, level);
  return accuracy >= 0.8;
}

/**
 * Gets the current study streak for a user.
 * Streak = consecutive calendar days (ending today or yesterday) with entries in study_days.
 * 
 * @param {object} db - better-sqlite3 database instance
 * @param {number} userId - User ID
 * @returns {number} Number of consecutive study days
 */
function getStreak(db, userId) {
  // Get all study days for user, ordered by date descending
  const studyDays = db.prepare(`
    SELECT study_date FROM study_days
    WHERE user_id = ?
    ORDER BY study_date DESC
  `).all(userId);

  if (studyDays.length === 0) {
    return 0;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // The streak must start from today or yesterday
  const mostRecentDate = studyDays[0].study_date;
  if (mostRecentDate !== todayStr && mostRecentDate !== yesterdayStr) {
    return 0;
  }

  // Count consecutive days backwards from the most recent date
  let streak = 1;
  let currentDate = new Date(mostRecentDate + 'T00:00:00');

  for (let i = 1; i < studyDays.length; i++) {
    const expectedPrevious = new Date(currentDate);
    expectedPrevious.setDate(expectedPrevious.getDate() - 1);
    const expectedPreviousStr = expectedPrevious.toISOString().split('T')[0];

    if (studyDays[i].study_date === expectedPreviousStr) {
      streak++;
      currentDate = expectedPrevious;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Gets study time for a user grouped by period.
 * 
 * @param {object} db - better-sqlite3 database instance
 * @param {number} userId - User ID
 * @param {string} period - One of: 'day', 'week', 'month'
 * @returns {number} Total seconds studied in the given period
 */
function getStudyTime(db, userId, period) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  let startDate;

  switch (period) {
    case 'day':
      startDate = todayStr;
      break;
    case 'week': {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      startDate = weekAgo.toISOString().split('T')[0];
      break;
    }
    case 'month': {
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);
      startDate = monthAgo.toISOString().split('T')[0];
      break;
    }
    default:
      throw new Error(`Invalid period: ${period}. Must be one of: day, week, month`);
  }

  const result = db.prepare(`
    SELECT COALESCE(SUM(total_seconds), 0) as total
    FROM study_days
    WHERE user_id = ? AND study_date >= ?
  `).get(userId, startDate);

  return result.total;
}

/**
 * Internal function: checks and awards achievements based on current progress.
 * Called after each completion.
 * 
 * @param {object} db - better-sqlite3 database instance
 * @param {number} userId - User ID
 */
function _checkAchievements(db, userId) {
  const achievementChecks = [
    { key: 'streak_7', check: () => getStreak(db, userId) >= 7 },
    { key: 'streak_30', check: () => getStreak(db, userId) >= 30 },
    { key: 'first_completion', check: () => {
      const count = db.prepare('SELECT COUNT(*) as c FROM progress WHERE user_id = ?').get(userId).c;
      return count >= 1;
    }},
    { key: 'ten_completions', check: () => {
      const count = db.prepare('SELECT COUNT(*) as c FROM progress WHERE user_id = ?').get(userId).c;
      return count >= 10;
    }},
    { key: 'fifty_completions', check: () => {
      const count = db.prepare('SELECT COUNT(*) as c FROM progress WHERE user_id = ?').get(userId).c;
      return count >= 50;
    }},
    { key: 'hundred_completions', check: () => {
      const count = db.prepare('SELECT COUNT(*) as c FROM progress WHERE user_id = ?').get(userId).c;
      return count >= 100;
    }},
    { key: 'perfect_score', check: () => {
      const result = db.prepare('SELECT COUNT(*) as c FROM progress WHERE user_id = ? AND score = 1.0').get(userId).c;
      return result >= 1;
    }},
    { key: 'beginner_complete', check: () => checkAdvancement(db, userId, 'beginner') },
    { key: 'intermediate_complete', check: () => checkAdvancement(db, userId, 'intermediate') },
    { key: 'advanced_complete', check: () => checkAdvancement(db, userId, 'advanced') },
  ];

  const insertAchievement = db.prepare(`
    INSERT OR IGNORE INTO achievements (user_id, achievement_key, earned_at)
    VALUES (?, ?, datetime('now'))
  `);

  for (const { key, check } of achievementChecks) {
    // Skip if already earned
    const existing = db.prepare(
      'SELECT id FROM achievements WHERE user_id = ? AND achievement_key = ?'
    ).get(userId, key);

    if (!existing && check()) {
      insertAchievement.run(userId, key);
    }
  }
}

module.exports = {
  recordCompletion,
  getAccuracy,
  getOverallAccuracy,
  checkAdvancement,
  getStreak,
  getStudyTime,
  ACTIVITY_TYPES
};
