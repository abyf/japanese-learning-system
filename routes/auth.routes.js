const express = require('express');
const { register, login } = require('../modules/auth');
const { authMiddleware } = require('../middleware/auth.middleware');
const config = require('../config');

const router = express.Router();

/**
 * POST /api/auth/register
 * Creates a new user account.
 * Also creates a settings record for the new user.
 * Sets JWT as httpOnly cookie on success.
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    const db = req.app.locals.db;

    const { userId, token } = await register(db, username, password, email);

    // Set JWT as httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: config.cookieMaxAge
    });

    res.status(201).json({ userId, username: username.trim() });

    // Log registration to Google Sheet (fire and forget)
    const sheetUrl = process.env.GOOGLE_SHEET_WEBHOOK;
    if (sheetUrl) {
      fetch(sheetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date().toISOString(),
          username: username.trim(),
          email: email || ''
        })
      }).catch(() => {}); // Silently ignore errors
    }
  } catch (err) {
    // Determine appropriate status code
    const message = err.message;
    let status = 400;
    if (message === 'Username already exists') {
      status = 409;
    }
    res.status(status).json({ error: message });
  }
});

/**
 * POST /api/auth/login
 * Authenticates a user and sets JWT as httpOnly cookie.
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const db = req.app.locals.db;

    const { userId, token } = await login(db, username, password);

    // Set JWT as httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: config.cookieMaxAge
    });

    res.json({ userId, username: username.trim() });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

/**
 * POST /api/auth/logout
 * Clears the JWT cookie.
 */
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'strict'
  });
  res.json({ message: 'Logged out successfully' });
});

/**
 * GET /api/auth/me
 * Returns the current authenticated user's information.
 * Protected by auth middleware.
 */
router.get('/me', authMiddleware, (req, res) => {
  const db = req.app.locals.db;
  const user = db.prepare(
    'SELECT id, username, current_level, theme, created_at FROM users WHERE id = ?'
  ).get(req.user.userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    userId: user.id,
    username: user.username,
    currentLevel: user.current_level,
    theme: user.theme,
    createdAt: user.created_at
  });
});

module.exports = router;
