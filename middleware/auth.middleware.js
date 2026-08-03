const { verifyToken } = require('../modules/auth');

/**
 * Authentication middleware.
 * Extracts JWT from the 'token' cookie, verifies it, and attaches
 * req.user = { userId } for downstream handlers.
 * Returns 401 Unauthorized if no token is present or token is invalid.
 */
function authMiddleware(req, res, next) {
  const token = req.cookies && req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = { userId: decoded.userId };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = { authMiddleware };
