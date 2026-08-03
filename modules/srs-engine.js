/**
 * SRS Engine — SM-2 Spaced Repetition Algorithm
 * 
 * Implements the SM-2 algorithm for scheduling vocabulary flashcard reviews.
 * Also provides database-backed functions for managing card state.
 */

/**
 * Computes the next SM-2 state given the current state and a quality rating.
 * 
 * SM-2 Algorithm rules:
 * - quality rating: 0-5
 * - new_ease_factor = max(1.3, old_EF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
 * - If quality >= 3: rep 0 → interval=1, rep 1 → interval=6, rep 2+ → interval = round(prev_interval * new_ease_factor), repetitionCount++
 * - If quality < 3: interval=1, repetitionCount stays unchanged
 * - next_review_date = today + new_interval days
 * 
 * @param {object} state - Current SM2 state
 * @param {number} state.interval - Current interval in days
 * @param {number} state.easeFactor - Current ease factor (minimum 1.3)
 * @param {number} state.repetitionCount - Number of consecutive correct reviews
 * @param {number} quality - Quality rating (0-5)
 * @returns {object} New SM2 state with updated interval, easeFactor, repetitionCount, nextReviewDate
 */
function computeSM2(state, quality) {
  if (quality < 0 || quality > 5 || !Number.isInteger(quality)) {
    throw new Error('Quality rating must be an integer between 0 and 5');
  }

  const { interval, easeFactor, repetitionCount } = state;

  // Calculate new ease factor
  const efDelta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  const newEaseFactor = Math.max(1.3, easeFactor + efDelta);

  let newInterval;
  let newRepetitionCount;

  if (quality >= 3) {
    // Correct response
    if (repetitionCount === 0) {
      newInterval = 1;
    } else if (repetitionCount === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval * newEaseFactor);
    }
    newRepetitionCount = repetitionCount + 1;
  } else {
    // Incorrect response — reset interval, keep repetition count
    newInterval = 1;
    newRepetitionCount = repetitionCount;
  }

  // Calculate next review date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextReview = new Date(today);
  nextReview.setDate(nextReview.getDate() + newInterval);
  const nextReviewDate = nextReview.toISOString().split('T')[0];

  return {
    interval: newInterval,
    easeFactor: newEaseFactor,
    repetitionCount: newRepetitionCount,
    nextReviewDate
  };
}

/**
 * Gets cards that are due for review for a given user.
 * Cards are due when their next_review_date <= today.
 * 
 * @param {object} db - better-sqlite3 database instance
 * @param {number} userId - User ID
 * @param {number} [limit=50] - Maximum number of cards to return
 * @returns {Array} Array of due card objects
 */
function getDueCards(db, userId, limit = 50) {
  const today = new Date().toISOString().split('T')[0];

  const cards = db.prepare(`
    SELECT id, card_id, level, interval, ease_factor, repetition_count,
           next_review_date, times_reviewed, times_correct, times_incorrect, current_streak
    FROM srs_state
    WHERE user_id = ? AND next_review_date <= ?
    ORDER BY next_review_date ASC
    LIMIT ?
  `).all(userId, today, limit);

  return cards.map(card => ({
    id: card.id,
    cardId: card.card_id,
    level: card.level,
    interval: card.interval,
    easeFactor: card.ease_factor,
    repetitionCount: card.repetition_count,
    nextReviewDate: card.next_review_date,
    timesReviewed: card.times_reviewed,
    timesCorrect: card.times_correct,
    timesIncorrect: card.times_incorrect,
    currentStreak: card.current_streak
  }));
}

/**
 * Gets new cards (not yet reviewed) for a given user and level.
 * New cards are those that don't have an srs_state row for this user.
 * Since we don't have a separate cards table, this returns cards that
 * have been inserted into srs_state with repetition_count = 0 and times_reviewed = 0.
 * 
 * For the current implementation, new cards are srs_state entries
 * that have never been reviewed (times_reviewed = 0).
 * 
 * @param {object} db - better-sqlite3 database instance
 * @param {number} userId - User ID
 * @param {string} level - Level filter (beginner, intermediate, advanced)
 * @param {number} [limit=10] - Maximum number of new cards to return
 * @returns {Array} Array of new card objects
 */
function getNewCards(db, userId, level, limit = 10) {
  const cards = db.prepare(`
    SELECT id, card_id, level, interval, ease_factor, repetition_count,
           next_review_date, times_reviewed, times_correct, times_incorrect, current_streak
    FROM srs_state
    WHERE user_id = ? AND level = ? AND times_reviewed = 0
    ORDER BY created_at ASC
    LIMIT ?
  `).all(userId, level, limit);

  return cards.map(card => ({
    id: card.id,
    cardId: card.card_id,
    level: card.level,
    interval: card.interval,
    easeFactor: card.ease_factor,
    repetitionCount: card.repetition_count,
    nextReviewDate: card.next_review_date,
    timesReviewed: card.times_reviewed,
    timesCorrect: card.times_correct,
    timesIncorrect: card.times_incorrect,
    currentStreak: card.current_streak
  }));
}

/**
 * Records a review for a card, updating the SRS state using SM-2.
 * 
 * Updates: interval, ease_factor, repetition_count, next_review_date,
 *          times_reviewed, times_correct/times_incorrect, current_streak
 * 
 * @param {object} db - better-sqlite3 database instance
 * @param {number} userId - User ID
 * @param {string} cardId - Card identifier
 * @param {number} quality - Quality rating (0-5)
 * @returns {object} Updated card state
 */
function recordReview(db, userId, cardId, quality) {
  if (quality < 0 || quality > 5 || !Number.isInteger(quality)) {
    throw new Error('Quality rating must be an integer between 0 and 5');
  }

  // Fetch current state
  const card = db.prepare(`
    SELECT id, interval, ease_factor, repetition_count, next_review_date,
           times_reviewed, times_correct, times_incorrect, current_streak
    FROM srs_state
    WHERE user_id = ? AND card_id = ?
  `).get(userId, cardId);

  if (!card) {
    throw new Error('Card not found');
  }

  // Compute new SM-2 state
  const currentState = {
    interval: card.interval,
    easeFactor: card.ease_factor,
    repetitionCount: card.repetition_count
  };

  const newState = computeSM2(currentState, quality);

  // Update statistics
  const timesReviewed = card.times_reviewed + 1;
  const timesCorrect = quality >= 3 ? card.times_correct + 1 : card.times_correct;
  const timesIncorrect = quality < 3 ? card.times_incorrect + 1 : card.times_incorrect;
  const currentStreak = quality >= 3 ? card.current_streak + 1 : 0;

  // Persist to database
  db.prepare(`
    UPDATE srs_state
    SET interval = ?,
        ease_factor = ?,
        repetition_count = ?,
        next_review_date = ?,
        times_reviewed = ?,
        times_correct = ?,
        times_incorrect = ?,
        current_streak = ?,
        updated_at = datetime('now')
    WHERE user_id = ? AND card_id = ?
  `).run(
    newState.interval,
    newState.easeFactor,
    newState.repetitionCount,
    newState.nextReviewDate,
    timesReviewed,
    timesCorrect,
    timesIncorrect,
    currentStreak,
    userId,
    cardId
  );

  return {
    cardId,
    interval: newState.interval,
    easeFactor: newState.easeFactor,
    repetitionCount: newState.repetitionCount,
    nextReviewDate: newState.nextReviewDate,
    timesReviewed,
    timesCorrect,
    timesIncorrect,
    currentStreak
  };
}

/**
 * Gets statistics for a specific card for a user.
 * 
 * @param {object} db - better-sqlite3 database instance
 * @param {number} userId - User ID
 * @param {string} cardId - Card identifier
 * @returns {object|null} Card statistics or null if not found
 */
function getCardStats(db, userId, cardId) {
  const card = db.prepare(`
    SELECT card_id, level, interval, ease_factor, repetition_count,
           next_review_date, times_reviewed, times_correct, times_incorrect,
           current_streak, created_at, updated_at
    FROM srs_state
    WHERE user_id = ? AND card_id = ?
  `).get(userId, cardId);

  if (!card) {
    return null;
  }

  return {
    cardId: card.card_id,
    level: card.level,
    interval: card.interval,
    easeFactor: card.ease_factor,
    repetitionCount: card.repetition_count,
    nextReviewDate: card.next_review_date,
    timesReviewed: card.times_reviewed,
    timesCorrect: card.times_correct,
    timesIncorrect: card.times_incorrect,
    currentStreak: card.current_streak,
    createdAt: card.created_at,
    updatedAt: card.updated_at
  };
}

module.exports = {
  computeSM2,
  getDueCards,
  getNewCards,
  recordReview,
  getCardStats
};
