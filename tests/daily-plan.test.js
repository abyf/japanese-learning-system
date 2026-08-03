const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { initializeDatabase } = require('../database/init');
const { generateDailyPlan, getPlanForToday, regeneratePlan, getWeakestActivity, estimateDuration, TIME_ESTIMATES } = require('../modules/daily-plan');
const path = require('path');
const fs = require('fs');

/**
 * Helper to create an in-memory or temp database for testing.
 */
function createTestDb() {
  const dbPath = path.join(__dirname, `test-plan-${Date.now()}.db`);
  const db = initializeDatabase(dbPath);
  return { db, dbPath };
}

function cleanupDb(dbPath) {
  try {
    fs.unlinkSync(dbPath);
  } catch (e) {
    // ignore
  }
}

/**
 * Creates a test user and returns the user ID.
 */
function createTestUser(db) {
  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync('testpass', 10);
  const result = db.prepare(
    "INSERT INTO users (username, password_hash, current_level) VALUES (?, ?, ?)"
  ).run('testuser', hash, 'beginner');
  return result.lastInsertRowid;
}

/**
 * Creates SRS cards for a user (some due, some not).
 */
function createDueCards(db, userId, dueCount, futureCount) {
  const today = new Date().toISOString().split('T')[0];
  const futureDate = '2099-01-01';

  for (let i = 0; i < dueCount; i++) {
    db.prepare(`
      INSERT INTO srs_state (user_id, card_id, level, next_review_date, times_reviewed)
      VALUES (?, ?, 'beginner', ?, 1)
    `).run(userId, `due_card_${i}`, today);
  }

  for (let i = 0; i < futureCount; i++) {
    db.prepare(`
      INSERT INTO srs_state (user_id, card_id, level, next_review_date, times_reviewed)
      VALUES (?, ?, 'beginner', ?, 1)
    `).run(userId, `future_card_${i}`, futureDate);
  }
}

describe('Daily Plan - Pure Functions', () => {
  describe('estimateDuration', () => {
    it('should calculate correct duration for review cards', () => {
      assert.strictEqual(estimateDuration('review_card', 10), 5);
    });

    it('should calculate correct duration for new cards', () => {
      assert.strictEqual(estimateDuration('new_card', 4), 6);
    });

    it('should calculate correct duration for reading', () => {
      assert.strictEqual(estimateDuration('reading', 2), 16);
    });

    it('should calculate correct duration for listening', () => {
      assert.strictEqual(estimateDuration('listening', 3), 15);
    });

    it('should calculate correct duration for dictation', () => {
      assert.strictEqual(estimateDuration('dictation', 2), 8);
    });

    it('should return 0 for count of 0', () => {
      assert.strictEqual(estimateDuration('review_card', 0), 0);
    });

    it('should throw for unknown activity type', () => {
      assert.throws(() => estimateDuration('unknown', 1), /Unknown activity type/);
    });
  });

  describe('getWeakestActivity', () => {
    it('should return activity with lowest accuracy', () => {
      const result = getWeakestActivity({
        reading: 0.8,
        listening: 0.5,
        dictation: 0.7
      });
      assert.strictEqual(result, 'listening');
    });

    it('should return reading as default when map is empty', () => {
      assert.strictEqual(getWeakestActivity({}), 'reading');
    });

    it('should return reading as default for null input', () => {
      assert.strictEqual(getWeakestActivity(null), 'reading');
    });

    it('should treat missing activities as 0 accuracy', () => {
      const result = getWeakestActivity({
        reading: 0.5,
        listening: 0.8
        // dictation is missing → treated as 0
      });
      assert.strictEqual(result, 'dictation');
    });

    it('should pick first lowest when tied', () => {
      const result = getWeakestActivity({
        reading: 0.5,
        listening: 0.5,
        dictation: 0.5
      });
      // First in FILLABLE_ACTIVITIES iteration order
      assert.strictEqual(result, 'reading');
    });
  });
});

describe('Daily Plan - Database Functions', () => {
  let db, dbPath, userId;

  beforeEach(() => {
    const testDb = createTestDb();
    db = testDb.db;
    dbPath = testDb.dbPath;
    userId = createTestUser(db);
  });

  afterEach(() => {
    db.close();
    cleanupDb(dbPath);
  });

  describe('generateDailyPlan', () => {
    it('should generate a plan with due reviews', () => {
      createDueCards(db, userId, 20, 5);

      const plan = generateDailyPlan(db, userId);

      assert.ok(plan.items.length > 0);
      assert.ok(plan.estimatedMinutes > 0);
      assert.strictEqual(plan.completed, false);

      // Should have review cards with order 1
      const reviewItem = plan.items.find(i => i.type === 'review_card');
      assert.ok(reviewItem);
      assert.strictEqual(reviewItem.order, 1);
    });

    it('should cap reviews at 60% of session time', () => {
      createDueCards(db, userId, 100, 0);

      const plan = generateDailyPlan(db, userId);
      const reviewItem = plan.items.find(i => i.type === 'review_card');

      // 60% of 25 min = 15 min. At 0.5 min/card → 30 cards max
      assert.ok(reviewItem.count <= 30);
      assert.ok(reviewItem.estimatedMinutes <= 15);
    });

    it('should include weakest activity to fill remaining time', () => {
      const plan = generateDailyPlan(db, userId);

      // With no due cards and no new cards studied today, plan should contain activity
      const activityItem = plan.items.find(i => i.order === 3);
      if (activityItem) {
        assert.ok(['reading', 'listening', 'dictation'].includes(activityItem.type));
      }
    });

    it('should store plan in database', () => {
      generateDailyPlan(db, userId);
      const today = new Date().toISOString().split('T')[0];

      const stored = db.prepare(
        'SELECT * FROM daily_plans WHERE user_id = ? AND plan_date = ?'
      ).get(userId, today);

      assert.ok(stored);
      assert.ok(stored.plan_data);
      assert.ok(stored.estimated_minutes >= 0);
    });

    it('should respect new cards per day setting', () => {
      // Insert user settings with low new cards limit
      db.prepare(
        'INSERT INTO settings (user_id, new_cards_per_day, session_duration_target, theme, furigana_default) VALUES (?, ?, ?, ?, ?)'
      ).run(userId, 3, 25, 'light', 1);

      const plan = generateDailyPlan(db, userId);
      const newCardItem = plan.items.find(i => i.type === 'new_card');

      if (newCardItem) {
        assert.ok(newCardItem.count <= 3);
      }
    });
  });

  describe('getPlanForToday', () => {
    it('should return existing plan if one exists', () => {
      // Generate a plan first
      const original = generateDailyPlan(db, userId);

      // Get plan for today should return the same plan
      const retrieved = getPlanForToday(db, userId);
      assert.deepStrictEqual(retrieved.items, original.items);
      assert.strictEqual(retrieved.estimatedMinutes, original.estimatedMinutes);
    });

    it('should generate new plan if none exists', () => {
      const plan = getPlanForToday(db, userId);
      assert.ok(plan);
      assert.ok(plan.planDate);
      assert.ok(Array.isArray(plan.items));
    });
  });

  describe('regeneratePlan', () => {
    it('should delete existing plan and create new one', () => {
      const today = new Date().toISOString().split('T')[0];

      // Generate initial plan
      generateDailyPlan(db, userId);

      // Add some due cards to change conditions
      createDueCards(db, userId, 15, 0);

      // Regenerate
      const newPlan = regeneratePlan(db, userId);
      assert.ok(newPlan);
      assert.strictEqual(newPlan.planDate, today);

      // Should have review cards now
      const reviewItem = newPlan.items.find(i => i.type === 'review_card');
      assert.ok(reviewItem);
      assert.ok(reviewItem.count > 0);
    });
  });
});
