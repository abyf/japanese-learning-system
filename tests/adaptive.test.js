const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { initializeDatabase } = require('../database/init');
const {
  adjustDifficultyScore,
  selectByDifficulty,
  getDifficultyScore,
  updateDifficultyScore,
  getRecentAccuracy
} = require('../modules/adaptive');

describe('Adaptive Difficulty Engine', () => {
  describe('adjustDifficultyScore (pure function)', () => {
    it('returns currentScore unchanged when fewer than 10 scores', () => {
      assert.equal(adjustDifficultyScore(0.5, [0.8, 0.9, 0.7]), 0.5);
      assert.equal(adjustDifficultyScore(0.3, []), 0.3);
      assert.equal(adjustDifficultyScore(0.7, [1, 1, 1, 1, 1, 1, 1, 1, 1]), 0.7);
    });

    it('increases by 0.1 when avg > 0.9', () => {
      const scores = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0];
      assert.equal(adjustDifficultyScore(0.5, scores), 0.6);
    });

    it('decreases by 0.1 when avg < 0.6', () => {
      const scores = [0.3, 0.4, 0.5, 0.2, 0.3, 0.4, 0.5, 0.3, 0.4, 0.5];
      assert.equal(adjustDifficultyScore(0.5, scores), 0.4);
    });

    it('stays unchanged when avg is between 0.6 and 0.9 inclusive', () => {
      const scores = [0.7, 0.8, 0.7, 0.8, 0.7, 0.8, 0.7, 0.8, 0.7, 0.8];
      assert.equal(adjustDifficultyScore(0.5, scores), 0.5);
    });

    it('clamps to 1.0 maximum', () => {
      const scores = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0];
      assert.equal(adjustDifficultyScore(0.95, scores), 1.0);
    });

    it('clamps to 0.0 minimum', () => {
      const scores = [0.0, 0.0, 0.1, 0.0, 0.0, 0.1, 0.0, 0.0, 0.1, 0.0];
      assert.equal(adjustDifficultyScore(0.05, scores), 0.0);
    });

    it('uses only the last 10 scores when more are provided', () => {
      // First 5 are low, but last 10 are all high → should increase
      const scores = [0.1, 0.1, 0.1, 0.1, 0.1, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0];
      assert.equal(adjustDifficultyScore(0.5, scores), 0.6);
    });

    it('rounds to 2 decimal places', () => {
      const scores = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0];
      const result = adjustDifficultyScore(0.33, scores);
      assert.equal(result, 0.43);
    });
  });

  describe('selectByDifficulty', () => {
    it('returns null for empty pool', () => {
      assert.equal(selectByDifficulty([], 0.5), null);
      assert.equal(selectByDifficulty(null, 0.5), null);
    });

    it('returns the only exercise when pool has one item', () => {
      const pool = [{ id: 'ex1', difficulty: 0.3 }];
      const result = selectByDifficulty(pool, 0.5);
      assert.equal(result.id, 'ex1');
    });

    it('selects from top 3 closest exercises', () => {
      const pool = [
        { id: 'ex1', difficulty: 0.1 },
        { id: 'ex2', difficulty: 0.4 },
        { id: 'ex3', difficulty: 0.5 },
        { id: 'ex4', difficulty: 0.6 },
        { id: 'ex5', difficulty: 0.9 }
      ];
      // Target is 0.5, closest 3 are ex3(0.5), ex2(0.4), ex4(0.6)
      const results = new Set();
      for (let i = 0; i < 100; i++) {
        const result = selectByDifficulty(pool, 0.5);
        results.add(result.id);
      }
      // Should only pick from ex2, ex3, ex4
      for (const id of results) {
        assert.ok(['ex2', 'ex3', 'ex4'].includes(id), `Unexpected selection: ${id}`);
      }
    });
  });

  describe('Database functions', () => {
    let db;

    beforeEach(() => {
      db = initializeDatabase(':memory:');
      // Create a test user
      db.prepare(`
        INSERT INTO users (username, password_hash, current_level)
        VALUES ('testuser', 'hash123', 'beginner')
      `).run();
    });

    describe('getDifficultyScore', () => {
      it('returns 0.5 when no record exists', () => {
        const score = getDifficultyScore(db, 1, 'reading');
        assert.equal(score, 0.5);
      });

      it('returns stored score when record exists', () => {
        db.prepare(`
          INSERT INTO difficulty_scores (user_id, activity_type, level, score)
          VALUES (1, 'reading', 'beginner', 0.7)
        `).run();
        const score = getDifficultyScore(db, 1, 'reading');
        assert.equal(score, 0.7);
      });
    });

    describe('getRecentAccuracy', () => {
      it('returns empty array when no progress records exist', () => {
        const scores = getRecentAccuracy(db, 1, 'reading', 10);
        assert.deepEqual(scores, []);
      });

      it('returns recent scores in chronological order', () => {
        // Insert progress records
        const insert = db.prepare(`
          INSERT INTO progress (user_id, activity_type, level, exercise_id, score, duration_seconds, completed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        insert.run(1, 'reading', 'beginner', 'ex1', 0.8, 60, '2024-01-01 10:00:00');
        insert.run(1, 'reading', 'beginner', 'ex2', 0.6, 60, '2024-01-01 11:00:00');
        insert.run(1, 'reading', 'beginner', 'ex3', 0.9, 60, '2024-01-01 12:00:00');

        const scores = getRecentAccuracy(db, 1, 'reading', 10);
        assert.deepEqual(scores, [0.8, 0.6, 0.9]);
      });

      it('respects windowSize limit', () => {
        const insert = db.prepare(`
          INSERT INTO progress (user_id, activity_type, level, exercise_id, score, duration_seconds, completed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (let i = 0; i < 15; i++) {
          insert.run(1, 'reading', 'beginner', `ex${i}`, 0.5 + i * 0.03, 60, `2024-01-01 ${10 + i}:00:00`);
        }

        const scores = getRecentAccuracy(db, 1, 'reading', 5);
        assert.equal(scores.length, 5);
      });
    });

    describe('updateDifficultyScore', () => {
      it('creates a difficulty_scores record when none exists', () => {
        // Insert enough progress records to trigger adjustment
        const insert = db.prepare(`
          INSERT INTO progress (user_id, activity_type, level, exercise_id, score, duration_seconds, completed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (let i = 0; i < 10; i++) {
          insert.run(1, 'reading', 'beginner', `ex${i}`, 1.0, 60, `2024-01-01 ${10 + i}:00:00`);
        }

        const newScore = updateDifficultyScore(db, 1, 'reading', true);
        assert.equal(newScore, 0.6); // 0.5 + 0.1 because avg is 1.0 > 0.9

        // Verify it was persisted
        const row = db.prepare('SELECT score FROM difficulty_scores WHERE user_id = 1 AND activity_type = ?').get('reading');
        assert.equal(row.score, 0.6);
      });

      it('does not change score when fewer than 10 progress records', () => {
        const insert = db.prepare(`
          INSERT INTO progress (user_id, activity_type, level, exercise_id, score, duration_seconds, completed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (let i = 0; i < 5; i++) {
          insert.run(1, 'reading', 'beginner', `ex${i}`, 1.0, 60, `2024-01-01 ${10 + i}:00:00`);
        }

        const newScore = updateDifficultyScore(db, 1, 'reading', true);
        assert.equal(newScore, 0.5); // unchanged, not enough data
      });
    });
  });
});
