/**
 * Japanese Learning System - Curriculum Routes
 * Provides API endpoints for curriculum progress, day activities, and unlocking.
 */
const express = require('express');
const {
  getCurriculum,
  getUserProgress,
  getDayActivities,
  markDayComplete,
  getUnlockedActivities,
  getWeekData
} = require('../modules/curriculum');

const router = express.Router();

/**
 * GET /api/curriculum/progress
 * Returns the user's curriculum progress (currentWeek, currentDay, percentComplete).
 */
router.get('/progress', (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.userId;

    const progress = getUserProgress(db, userId);
    const curriculum = getCurriculum('beginner');

    res.json({
      ...progress,
      totalWeeks: curriculum.totalWeeks,
      title: curriculum.title,
      titleFr: curriculum.titleFr,
      description: curriculum.description,
      descriptionFr: curriculum.descriptionFr,
      minutesPerDay: curriculum.minutesPerDay,
      targetHoursPerYear: curriculum.targetHoursPerYear
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve curriculum progress' });
  }
});

/**
 * GET /api/curriculum/week/:week
 * Returns all days + activities for a specific week, with completion status.
 */
router.get('/week/:week', (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.userId;
    const weekNum = parseInt(req.params.week, 10);

    if (isNaN(weekNum) || weekNum < 1 || weekNum > 52) {
      return res.status(400).json({ error: 'Invalid week number' });
    }

    const weekData = getWeekData(db, userId, 'beginner', weekNum);
    if (!weekData) {
      return res.status(404).json({ error: 'Week not found' });
    }

    // Inject Portuguese theme from translation file if available
    const { loadTranslationFile } = require('../modules/translations');
    const ptTranslations = loadTranslationFile('pt');
    if (ptTranslations && ptTranslations.curriculum && ptTranslations.curriculum.weeks) {
      weekData.themePt = ptTranslations.curriculum.weeks[String(weekNum)] || weekData.theme;
    }

    res.json(weekData);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve week data' });
  }
});

/**
 * GET /api/curriculum/today
 * Returns today's activities based on user's current progress position.
 */
router.get('/today', (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.userId;

    const progress = getUserProgress(db, userId);
    const dayData = getDayActivities('beginner', progress.currentWeek, progress.currentDay);

    if (!dayData) {
      return res.status(404).json({ error: 'No activities found for current day' });
    }

    // Inject Portuguese theme from translation file
    const { loadTranslationFile } = require('../modules/translations');
    const ptTranslations = loadTranslationFile('pt');
    if (ptTranslations && ptTranslations.curriculum && ptTranslations.curriculum.weeks) {
      dayData.themePt = ptTranslations.curriculum.weeks[String(progress.currentWeek)] || dayData.theme;
    }

    res.json({
      ...dayData,
      currentWeek: progress.currentWeek,
      currentDay: progress.currentDay,
      percentComplete: progress.percentComplete
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve today\'s activities' });
  }
});

/**
 * POST /api/curriculum/day/:week/:day/complete
 * Mark a specific day as complete.
 */
router.post('/day/:week/:day/complete', (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.userId;
    const week = parseInt(req.params.week, 10);
    const day = parseInt(req.params.day, 10);

    if (isNaN(week) || isNaN(day) || week < 1 || day < 1 || day > 7) {
      return res.status(400).json({ error: 'Invalid week or day number' });
    }

    const result = markDayComplete(db, userId, week, day);
    
    // Return updated progress after marking complete
    const progress = getUserProgress(db, userId);
    
    res.json({
      ...result,
      progress
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark day as complete' });
  }
});

/**
 * GET /api/curriculum/unlocked
 * Returns list of unlocked exercise IDs for the authenticated user.
 */
router.get('/unlocked', (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.userId;

    const unlocked = getUnlockedActivities(db, userId);
    res.json({ unlocked });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve unlocked activities' });
  }
});

/**
 * POST /api/curriculum/external-done
 * Mark an external activity as done.
 * Body: { week, day, activityIndex }
 */
router.post('/external-done', (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.userId;
    const { week, day, activityIndex } = req.body;

    if (!week || !day || activityIndex === undefined) {
      return res.status(400).json({ error: 'week, day, and activityIndex are required' });
    }

    db.prepare(
      'INSERT OR IGNORE INTO external_activity_done (user_id, week, day, activity_index) VALUES (?, ?, ?, ?)'
    ).run(userId, week, day, activityIndex);
    db.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark activity as done' });
  }
});

module.exports = router;
