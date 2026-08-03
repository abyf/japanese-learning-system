/**
 * Adaptive Difficulty Engine
 * 
 * Maintains a difficulty_score per activity per user, adjusts based on
 * rolling 10-exercise accuracy window, and selects exercises matching
 * the learner's current difficulty score.
 */

/**
 * Adjusts difficulty score based on recent performance.
 * Pure function — no database interaction.
 * 
 * Rules:
 * - If fewer than 10 recent scores, return currentScore unchanged
 * - Average the last 10 scores:
 *   - > 0.9 average → increase by 0.1
 *   - < 0.6 average → decrease by 0.1
 *   - otherwise → no change
 * - Clamp result to [0.0, 1.0]
 * - Round to 2 decimal places
 * 
 * @param {number} currentScore - Current difficulty score (0.0–1.0)
 * @param {number[]} recentScores - Array of recent exercise scores (0.0–1.0 each)
 * @returns {number} Adjusted difficulty score
 */
function adjustDifficultyScore(currentScore, recentScores) {
  if (recentScores.length < 10) {
    return currentScore;
  }

  const windowScores = recentScores.slice(-10);
  const avgAccuracy = Math.round(windowScores.reduce((sum, s) => sum + s, 0) / 10 * 1e10) / 1e10;

  let newScore = currentScore;

  if (avgAccuracy > 0.9) {
    newScore = currentScore + 0.1;
  } else if (avgAccuracy < 0.6) {
    newScore = currentScore - 0.1;
  }

  // Clamp to [0.0, 1.0]
  newScore = Math.max(0.0, Math.min(1.0, newScore));

  // Round to 2 decimal places
  return Math.round(newScore * 100) / 100;
}

/**
 * Selects an exercise from available pool matching target difficulty.
 * Sorts by distance from targetScore, picks randomly from top 3 closest.
 * 
 * @param {Array<{difficulty: number}>} available - Pool of exercises with difficulty values
 * @param {number} targetScore - Learner's current difficulty score
 * @returns {object|null} Selected exercise, or null if pool is empty
 */
function selectByDifficulty(available, targetScore) {
  if (!available || available.length === 0) {
    return null;
  }

  // Sort by distance from target score
  const sorted = [...available].sort(
    (a, b) => Math.abs(a.difficulty - targetScore) - Math.abs(b.difficulty - targetScore)
  );

  // Pick randomly from top 3 closest
  const candidates = sorted.slice(0, Math.min(3, sorted.length));
  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index];
}

/**
 * Gets the current difficulty score for a user's activity type.
 * Returns 0.5 (default) if no record exists.
 * 
 * @param {object} db - better-sqlite3 database instance
 * @param {number} userId - User ID
 * @param {string} activityType - Activity type (reading, listening, dictation, vocabulary)
 * @returns {number} Current difficulty score (0.0–1.0)
 */
function getDifficultyScore(db, userId, activityType) {
  const row = db.prepare(`
    SELECT score FROM difficulty_scores
    WHERE user_id = ? AND activity_type = ?
    ORDER BY updated_at DESC
    LIMIT 1
  `).get(userId, activityType);

  return row ? row.score : 0.5;
}

/**
 * Updates the difficulty score for a user's activity type.
 * Fetches the last 10 progress scores, computes the new difficulty,
 * and upserts into difficulty_scores.
 * 
 * @param {object} db - better-sqlite3 database instance
 * @param {number} userId - User ID
 * @param {string} activityType - Activity type
 * @param {boolean} wasCorrect - Whether the latest exercise was answered correctly
 * @returns {number} The new difficulty score
 */
function updateDifficultyScore(db, userId, activityType, wasCorrect) {
  // Get current score
  const currentScore = getDifficultyScore(db, userId, activityType);

  // Get recent scores from progress table (last 10)
  const recentScores = getRecentAccuracy(db, userId, activityType, 10);

  // Compute adjusted score
  const newScore = adjustDifficultyScore(currentScore, recentScores);

  // Get user's current level for the upsert
  const user = db.prepare('SELECT current_level FROM users WHERE id = ?').get(userId);
  const level = user ? user.current_level : 'beginner';

  // Upsert difficulty_scores
  db.prepare(`
    INSERT INTO difficulty_scores (user_id, activity_type, level, score, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, activity_type, level)
    DO UPDATE SET score = ?, updated_at = datetime('now')
  `).run(userId, activityType, level, newScore, newScore);

  return newScore;
}

/**
 * Gets recent exercise scores from the progress table.
 * Returns an array of the last N score values for the given user and activity.
 * 
 * @param {object} db - better-sqlite3 database instance
 * @param {number} userId - User ID
 * @param {string} activityType - Activity type
 * @param {number} windowSize - Number of recent scores to retrieve
 * @returns {number[]} Array of recent scores (0.0–1.0)
 */
function getRecentAccuracy(db, userId, activityType, windowSize) {
  const rows = db.prepare(`
    SELECT score FROM progress
    WHERE user_id = ? AND activity_type = ?
    ORDER BY completed_at DESC
    LIMIT ?
  `).all(userId, activityType, windowSize);

  // Reverse so oldest is first (chronological order)
  return rows.map(r => r.score).reverse();
}

module.exports = {
  adjustDifficultyScore,
  selectByDifficulty,
  getDifficultyScore,
  updateDifficultyScore,
  getRecentAccuracy
};
