const express = require('express');
const { getPlanForToday, regeneratePlan } = require('../modules/daily-plan');

const router = express.Router();

/**
 * GET /api/plan/today
 * Returns today's study plan for the authenticated user.
 * If no plan exists for today, generates a new one.
 */
router.get('/today', (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.userId;

    const plan = getPlanForToday(db, userId);
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve daily plan' });
  }
});

/**
 * POST /api/plan/regenerate
 * Deletes today's plan and generates a fresh one.
 * Useful when the user wants to refresh their daily plan.
 */
router.post('/regenerate', (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.userId;

    const plan = regeneratePlan(db, userId);
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: 'Failed to regenerate daily plan' });
  }
});

module.exports = router;
