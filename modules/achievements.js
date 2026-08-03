/**
 * Achievement System Module
 * 
 * Defines 15+ achievement milestones, evaluates conditions after
 * each activity completion, and awards badges to learners.
 */

const { getStreak } = require('./progress');

/**
 * Achievement definitions.
 * Each has a key (unique identifier), name, description, icon, and condition function.
 */
const ACHIEVEMENT_DEFS = [
  // Streak achievements
  {
    key: 'streak_7',
    name: '7-Day Streak',
    description: 'Study for 7 consecutive days',
    icon: '🔥',
    check: (db, userId) => getStreak(db, userId) >= 7
  },
  {
    key: 'streak_30',
    name: '30-Day Streak',
    description: 'Study for 30 consecutive days',
    icon: '🔥🔥',
    check: (db, userId) => getStreak(db, userId) >= 30
  },
  {
    key: 'streak_100',
    name: '100-Day Streak',
    description: 'Study for 100 consecutive days',
    icon: '🔥🔥🔥',
    check: (db, userId) => getStreak(db, userId) >= 100
  },

  // Cards mastered achievements
  {
    key: 'cards_100',
    name: 'Century Club',
    description: 'Master 100 vocabulary cards',
    icon: '📚',
    check: (db, userId) => {
      const result = db.prepare(
        'SELECT COUNT(*) as count FROM srs_state WHERE user_id = ? AND repetition_count >= 5'
      ).get(userId);
      return (result && result.count >= 100);
    }
  },
  {
    key: 'cards_500',
    name: 'Word Wizard',
    description: 'Master 500 vocabulary cards',
    icon: '🧙',
    check: (db, userId) => {
      const result = db.prepare(
        'SELECT COUNT(*) as count FROM srs_state WHERE user_id = ? AND repetition_count >= 5'
      ).get(userId);
      return (result && result.count >= 500);
    }
  },

  // Level completion achievements
  {
    key: 'level_beginner',
    name: 'Beginner Complete',
    description: 'Complete the Beginner level',
    icon: '🌱',
    check: (db, userId) => {
      const user = db.prepare('SELECT current_level FROM users WHERE id = ?').get(userId);
      return user && (user.current_level === 'intermediate' || user.current_level === 'advanced');
    }
  },
  {
    key: 'level_intermediate',
    name: 'Intermediate Complete',
    description: 'Complete the Intermediate level',
    icon: '🌿',
    check: (db, userId) => {
      const user = db.prepare('SELECT current_level FROM users WHERE id = ?').get(userId);
      return user && user.current_level === 'advanced';
    }
  },
  {
    key: 'level_advanced',
    name: 'Master Scholar',
    description: 'Complete the Advanced level with 80%+ accuracy',
    icon: '🎓',
    check: (db, userId) => {
      const result = db.prepare(`
        SELECT COUNT(*) as total,
          SUM(CASE WHEN score >= 0.5 THEN 1 ELSE 0 END) as correct
        FROM progress WHERE user_id = ? AND level = 'advanced'
      `).get(userId);
      if (!result || result.total < 20) return false;
      return (result.correct / result.total) >= 0.8;
    }
  },

  // Perfect score achievements
  {
    key: 'perfect_reading',
    name: 'Perfect Reader',
    description: 'Score 100% on a reading exercise',
    icon: '📖',
    check: (db, userId) => {
      const result = db.prepare(
        "SELECT COUNT(*) as count FROM progress WHERE user_id = ? AND activity_type = 'reading' AND score = 1.0"
      ).get(userId);
      return (result && result.count > 0);
    }
  },
  {
    key: 'perfect_listening',
    name: 'Perfect Listener',
    description: 'Score 100% on a listening exercise',
    icon: '👂',
    check: (db, userId) => {
      const result = db.prepare(
        "SELECT COUNT(*) as count FROM progress WHERE user_id = ? AND activity_type = 'listening' AND score = 1.0"
      ).get(userId);
      return (result && result.count > 0);
    }
  },
  {
    key: 'perfect_dictation',
    name: 'Perfect Scribe',
    description: 'Score 100% on a dictation exercise',
    icon: '✍️',
    check: (db, userId) => {
      const result = db.prepare(
        "SELECT COUNT(*) as count FROM progress WHERE user_id = ? AND activity_type = 'dictation' AND score = 1.0"
      ).get(userId);
      return (result && result.count > 0);
    }
  },

  // First actions
  {
    key: 'first_review',
    name: 'First Steps',
    description: 'Complete your first flashcard review',
    icon: '👣',
    check: (db, userId) => {
      const result = db.prepare(
        'SELECT COUNT(*) as count FROM srs_state WHERE user_id = ? AND times_reviewed > 0'
      ).get(userId);
      return (result && result.count > 0);
    }
  },
  {
    key: 'reviews_1000',
    name: 'Review Master',
    description: 'Complete 1000 flashcard reviews',
    icon: '🏆',
    check: (db, userId) => {
      const result = db.prepare(
        'SELECT SUM(times_reviewed) as total FROM srs_state WHERE user_id = ?'
      ).get(userId);
      return (result && result.total >= 1000);
    }
  },

  // Export achievement
  {
    key: 'first_export',
    name: 'Data Guardian',
    description: 'Export your learning data for the first time',
    icon: '💾',
    // This is triggered manually when export is called
    check: () => false // Never auto-triggered; awarded explicitly
  },

  // All activities completed
  {
    key: 'all_activities',
    name: 'Well-Rounded',
    description: 'Complete at least one exercise of each type (reading, listening, dictation, vocabulary)',
    icon: '🌟',
    check: (db, userId) => {
      const types = ['reading', 'listening', 'dictation', 'vocabulary'];
      for (const type of types) {
        const result = db.prepare(
          'SELECT COUNT(*) as count FROM progress WHERE user_id = ? AND activity_type = ?'
        ).get(userId, type);
        if (!result || result.count === 0) return false;
      }
      return true;
    }
  },

  // Study time achievements
  {
    key: 'study_10_hours',
    name: 'Dedicated Student',
    description: 'Study for a total of 10 hours',
    icon: '⏰',
    check: (db, userId) => {
      const result = db.prepare(
        'SELECT SUM(total_seconds) as total FROM study_days WHERE user_id = ?'
      ).get(userId);
      return (result && result.total >= 36000); // 10 hours in seconds
    }
  }
];

/**
 * Evaluates all achievement conditions for a user and awards any newly earned ones.
 * Called after each activity completion.
 * 
 * @param {object} db - Database instance
 * @param {number} userId - User ID
 * @returns {Array} Array of newly earned achievement objects
 */
function evaluateAchievements(db, userId) {
  const newlyEarned = [];

  // Get already earned achievements
  const earned = db.prepare(
    'SELECT achievement_key FROM achievements WHERE user_id = ?'
  ).all(userId);
  const earnedKeys = new Set(earned.map(a => a.achievement_key));

  for (const def of ACHIEVEMENT_DEFS) {
    // Skip if already earned
    if (earnedKeys.has(def.key)) continue;

    // Check condition
    try {
      if (def.check(db, userId)) {
        // Award achievement
        db.prepare(
          'INSERT OR IGNORE INTO achievements (user_id, achievement_key) VALUES (?, ?)'
        ).run(userId, def.key);

        newlyEarned.push({
          key: def.key,
          name: def.name,
          description: def.description,
          icon: def.icon
        });
      }
    } catch (err) {
      // Don't let a failing achievement check break the flow
      console.error(`Error checking achievement ${def.key}:`, err.message);
    }
  }

  return newlyEarned;
}

/**
 * Gets all achievements earned by a user.
 * 
 * @param {object} db - Database instance
 * @param {number} userId - User ID
 * @returns {Array} Array of earned achievement objects with earned date
 */
function getEarnedAchievements(db, userId) {
  const earned = db.prepare(
    'SELECT achievement_key, earned_at FROM achievements WHERE user_id = ?'
  ).all(userId);

  return earned.map(record => {
    const def = ACHIEVEMENT_DEFS.find(d => d.key === record.achievement_key);
    return {
      key: record.achievement_key,
      name: def ? def.name : record.achievement_key,
      description: def ? def.description : '',
      icon: def ? def.icon : '🏅',
      earnedAt: record.earned_at
    };
  });
}

/**
 * Checks a single achievement condition for a user.
 * 
 * @param {object} db - Database instance
 * @param {number} userId - User ID
 * @param {object} achievementDef - Achievement definition object
 * @returns {boolean} Whether the condition is met
 */
function checkCondition(db, userId, achievementDef) {
  try {
    return achievementDef.check(db, userId);
  } catch {
    return false;
  }
}

/**
 * Awards a specific achievement manually (e.g., 'first_export').
 * 
 * @param {object} db - Database instance
 * @param {number} userId - User ID
 * @param {string} achievementKey - Achievement key to award
 * @returns {object|null} The awarded achievement or null if already earned
 */
function awardAchievement(db, userId, achievementKey) {
  const existing = db.prepare(
    'SELECT achievement_key FROM achievements WHERE user_id = ? AND achievement_key = ?'
  ).get(userId, achievementKey);

  if (existing) return null;

  db.prepare(
    'INSERT INTO achievements (user_id, achievement_key) VALUES (?, ?)'
  ).run(userId, achievementKey);

  const def = ACHIEVEMENT_DEFS.find(d => d.key === achievementKey);
  return def ? { key: def.key, name: def.name, description: def.description, icon: def.icon } : null;
}

module.exports = {
  evaluateAchievements,
  getEarnedAchievements,
  checkCondition,
  awardAchievement,
  ACHIEVEMENT_DEFS
};
