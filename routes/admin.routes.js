/**
 * Admin Routes
 * 
 * Protected by a secret key (ADMIN_KEY env var or default for local dev).
 * Provides user listing and activity stats for the administrator.
 */
const express = require('express');
const router = express.Router();

const ADMIN_KEY = process.env.ADMIN_KEY || 'jls-admin-2024';

/**
 * Middleware: Check admin key
 */
function checkAdminKey(req, res, next) {
  const key = req.query.key || req.headers['x-admin-key'];
  if (key !== ADMIN_KEY) {
    return res.status(403).json({ error: 'Invalid admin key' });
  }
  next();
}

/**
 * GET /api/admin/users?key=YOUR_KEY
 * Lists all registered users with their progress summary.
 */
router.get('/users', checkAdminKey, (req, res) => {
  try {
    const db = req.app.locals.db;

    const users = db.prepare(`
      SELECT id, username, email, current_level, created_at FROM users ORDER BY created_at DESC
    `).all();

    const usersWithStats = users.map(user => {
      // Count completed exercises
      const exerciseCount = db.prepare(
        'SELECT COUNT(DISTINCT exercise_id) as count FROM progress WHERE user_id = ? AND score = 1.0'
      ).get(user.id);

      // Count curriculum days completed
      const curriculumDays = db.prepare(
        'SELECT COUNT(*) as count FROM curriculum_progress WHERE user_id = ? AND completed = 1'
      ).get(user.id);

      // Get latest curriculum position
      const latestDay = db.prepare(
        'SELECT week, day, completed_at FROM curriculum_progress WHERE user_id = ? AND completed = 1 ORDER BY week DESC, day DESC LIMIT 1'
      ).get(user.id);

      // Last activity date
      const lastActive = db.prepare(
        'SELECT MAX(completed_at) as last FROM progress WHERE user_id = ?'
      ).get(user.id);

      return {
        id: user.id,
        username: user.username,
        email: user.email || '',
        level: user.current_level,
        registeredAt: user.created_at,
        exercisesCompleted: exerciseCount ? exerciseCount.count : 0,
        curriculumDaysCompleted: curriculumDays ? curriculumDays.count : 0,
        currentWeek: latestDay ? latestDay.week : 1,
        currentDay: latestDay ? latestDay.day : 1,
        lastActive: lastActive ? lastActive.last : user.created_at
      };
    });

    res.json({
      totalUsers: users.length,
      users: usersWithStats
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve users', message: err.message });
  }
});

/**
 * GET /api/admin/stats?key=YOUR_KEY
 * Overall platform statistics.
 */
router.get('/stats', checkAdminKey, (req, res) => {
  try {
    const db = req.app.locals.db;

    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const totalProgress = db.prepare('SELECT COUNT(*) as count FROM progress').get().count;
    const totalCurriculumDays = db.prepare('SELECT COUNT(*) as count FROM curriculum_progress WHERE completed = 1').get().count;
    const totalExternalDone = db.prepare('SELECT COUNT(*) as count FROM external_activity_done').get().count;

    res.json({
      totalUsers,
      totalExerciseSubmissions: totalProgress,
      totalCurriculumDaysCompleted: totalCurriculumDays,
      totalExternalActivitiesMarkedDone: totalExternalDone
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve stats', message: err.message });
  }
});

module.exports = router;
