/**
 * Daily Plan Generator Module
 * 
 * Generates a personalized daily study plan based on:
 * 1. Due SRS reviews (highest priority)
 * 2. New vocabulary cards (second priority)
 * 3. Weakest activity practice (fills remaining time)
 * 
 * Target session duration: 20-30 minutes (configurable via settings).
 * Reviews capped at 60% of session time; new cards capped at daily limit.
 */

const { getDueCards } = require('./srs-engine');
const { getAccuracy } = require('./progress');

/**
 * Time estimates per activity type (in minutes).
 */
const TIME_ESTIMATES = {
  review_card: 0.5,   // 30 seconds per review card
  new_card: 1.5,      // 90 seconds per new card
  reading: 8,         // per passage
  listening: 5,       // per exercise
  dictation: 4        // per exercise
};

/**
 * Default target session duration in minutes.
 */
const TARGET_MINUTES = 25;

/**
 * Activities eligible for "weakest activity" fill.
 */
const FILLABLE_ACTIVITIES = ['reading', 'listening', 'dictation'];

/**
 * Estimates the duration in minutes for a given activity type and count.
 * 
 * @param {string} activityType - One of: review_card, new_card, reading, listening, dictation
 * @param {number} count - Number of items
 * @returns {number} Estimated duration in minutes
 */
function estimateDuration(activityType, count) {
  const perItem = TIME_ESTIMATES[activityType];
  if (perItem === undefined) {
    throw new Error(`Unknown activity type: ${activityType}`);
  }
  if (count < 0) {
    return 0;
  }
  return perItem * count;
}

/**
 * Determines the weakest activity based on accuracy scores.
 * Returns the activity with the lowest accuracy from the provided map.
 * If all accuracies are equal or the map is empty, defaults to 'reading'.
 * 
 * @param {object} accuracyByActivity - Map of activity type → accuracy (0.0 to 1.0)
 * @returns {string} The activity type with the lowest accuracy
 */
function getWeakestActivity(accuracyByActivity) {
  if (!accuracyByActivity || Object.keys(accuracyByActivity).length === 0) {
    return 'reading';
  }

  let weakest = null;
  let lowestAccuracy = Infinity;

  for (const activity of FILLABLE_ACTIVITIES) {
    const accuracy = accuracyByActivity[activity];
    // Treat undefined/null as 0 (no data = weakest)
    const effectiveAccuracy = (accuracy !== undefined && accuracy !== null) ? accuracy : 0;

    if (effectiveAccuracy < lowestAccuracy) {
      lowestAccuracy = effectiveAccuracy;
      weakest = activity;
    }
  }

  return weakest || 'reading';
}

/**
 * Generates a daily study plan for a user.
 * 
 * Logic:
 * 1. Get due card count from srs_state (next_review_date <= today)
 * 2. Include due reviews: cap at 60% of total time
 * 3. Get new cards available: newCardsLimit - newCardsToday, allocate up to 30% remaining time
 * 4. Fill remaining time with weakest activity (reading, listening, or dictation)
 * 5. Each plan item has: type, count, estimatedMinutes, order
 * 
 * @param {object} db - better-sqlite3 database instance
 * @param {number} userId - User ID
 * @returns {object} Plan object with items array and estimated total minutes
 */
function generateDailyPlan(db, userId) {
  const today = new Date().toISOString().split('T')[0];

  // Get user settings (or defaults)
  const settings = db.prepare(
    'SELECT new_cards_per_day, session_duration_target FROM settings WHERE user_id = ?'
  ).get(userId);

  const newCardsPerDay = settings ? settings.new_cards_per_day : 10;
  const targetMinutes = settings ? settings.session_duration_target : TARGET_MINUTES;

  // Get user's current level
  const user = db.prepare('SELECT current_level FROM users WHERE id = ?').get(userId);
  const level = user ? user.current_level : 'beginner';

  // Step 1: Count due reviews
  const dueCardsResult = db.prepare(
    'SELECT COUNT(*) as count FROM srs_state WHERE user_id = ? AND next_review_date <= ?'
  ).get(userId, today);
  const totalDueCards = dueCardsResult ? dueCardsResult.count : 0;

  // Step 2: Cap reviews at 60% of session time
  const maxReviewMinutes = targetMinutes * 0.6;
  const maxReviewCards = Math.floor(maxReviewMinutes / TIME_ESTIMATES.review_card);
  const reviewCardCount = Math.min(totalDueCards, maxReviewCards);
  const reviewMinutes = estimateDuration('review_card', reviewCardCount);

  // Step 3: New cards - check how many already studied today
  const newCardsToday = db.prepare(`
    SELECT COUNT(*) as count FROM srs_state
    WHERE user_id = ? AND times_reviewed = 1
    AND updated_at >= ? AND updated_at < date(?, '+1 day')
  `).get(userId, today, today);

  const newCardsTodayCount = newCardsToday ? newCardsToday.count : 0;
  const newCardsAvailable = Math.max(0, newCardsPerDay - newCardsTodayCount);

  // Allocate new cards up to 30% of remaining time
  const remainingAfterReviews = targetMinutes - reviewMinutes;
  const maxNewCardMinutes = remainingAfterReviews * 0.3;
  const maxNewCards = Math.floor(maxNewCardMinutes / TIME_ESTIMATES.new_card);
  const newCardCount = Math.min(newCardsAvailable, maxNewCards);
  const newCardMinutes = estimateDuration('new_card', newCardCount);

  // Step 4: Fill remaining time with weakest activity
  const remainingTime = targetMinutes - reviewMinutes - newCardMinutes;

  // Get accuracy for each fillable activity to determine weakest
  const accuracyByActivity = {};
  for (const activity of FILLABLE_ACTIVITIES) {
    accuracyByActivity[activity] = getAccuracy(db, userId, activity, level);
  }

  const weakestActivity = getWeakestActivity(accuracyByActivity);
  const activityTimeEstimate = TIME_ESTIMATES[weakestActivity];
  const activityCount = Math.max(0, Math.floor(remainingTime / activityTimeEstimate));
  const activityMinutes = estimateDuration(weakestActivity, activityCount);

  // Build plan items
  const items = [];

  if (reviewCardCount > 0) {
    items.push({
      type: 'review_card',
      count: reviewCardCount,
      level,
      estimatedMinutes: reviewMinutes,
      order: 1
    });
  }

  if (newCardCount > 0) {
    items.push({
      type: 'new_card',
      count: newCardCount,
      level,
      estimatedMinutes: newCardMinutes,
      order: 2
    });
  }

  if (activityCount > 0) {
    items.push({
      type: weakestActivity,
      count: activityCount,
      level,
      estimatedMinutes: activityMinutes,
      order: 3
    });
  }

  const totalEstimatedMinutes = Math.round(reviewMinutes + newCardMinutes + activityMinutes);

  // Store plan in database
  const planData = JSON.stringify(items);

  db.prepare(`
    INSERT INTO daily_plans (user_id, plan_date, plan_data, estimated_minutes)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, plan_date) DO UPDATE SET
      plan_data = excluded.plan_data,
      estimated_minutes = excluded.estimated_minutes,
      created_at = datetime('now')
  `).run(userId, today, planData, totalEstimatedMinutes);

  return {
    planDate: today,
    items,
    estimatedMinutes: totalEstimatedMinutes,
    completed: false
  };
}

/**
 * Gets the plan for today. Returns existing plan if one exists,
 * otherwise generates a new one.
 * 
 * @param {object} db - better-sqlite3 database instance
 * @param {number} userId - User ID
 * @returns {object} Today's plan
 */
function getPlanForToday(db, userId) {
  const today = new Date().toISOString().split('T')[0];

  const existing = db.prepare(
    'SELECT plan_date, plan_data, estimated_minutes, completed FROM daily_plans WHERE user_id = ? AND plan_date = ?'
  ).get(userId, today);

  if (existing) {
    return {
      planDate: existing.plan_date,
      items: JSON.parse(existing.plan_data),
      estimatedMinutes: existing.estimated_minutes,
      completed: existing.completed === 1
    };
  }

  // Generate new plan
  return generateDailyPlan(db, userId);
}

/**
 * Deletes today's plan and generates a fresh one.
 * Useful when user wants to refresh their daily plan.
 * 
 * @param {object} db - better-sqlite3 database instance
 * @param {number} userId - User ID
 * @returns {object} Newly generated plan
 */
function regeneratePlan(db, userId) {
  const today = new Date().toISOString().split('T')[0];

  // Delete existing plan for today
  db.prepare(
    'DELETE FROM daily_plans WHERE user_id = ? AND plan_date = ?'
  ).run(userId, today);

  // Generate fresh plan
  return generateDailyPlan(db, userId);
}

module.exports = {
  generateDailyPlan,
  getPlanForToday,
  regeneratePlan,
  getWeakestActivity,
  estimateDuration,
  TIME_ESTIMATES,
  TARGET_MINUTES,
  FILLABLE_ACTIVITIES
};
