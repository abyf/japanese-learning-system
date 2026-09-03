/**
 * Platform Auth Middleware (Task 3.1)
 *
 * Verifies the Supabase access token from the Authorization header (or the
 * sb-access-token cookie) and sets `req.user = { id, email }`.
 *
 * Returns 401 if the token is missing or invalid. Route handlers downstream
 * can rely on `req.user.id` being a verified Supabase auth.users UUID.
 *
 * Uses the admin client's auth.getUser() (server-side verification against
 * Supabase) — this is the safest check, as it validates the token is not
 * revoked and the user still exists.
 */

'use strict';

const { getUserFromToken } = require('../lib/supabase');

/**
 * Express middleware: verifies Supabase JWT, sets req.user, or returns 401.
 */
async function platformAuth(req, res, next) {
  // 1. Try the Authorization header first (standard for API calls from the SPA).
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // 2. Fall back to a cookie (for server-rendered pages or redirects).
  if (!token && req.cookies) {
    token = req.cookies['sb-access-token'] || req.cookies['sb_access_token'];
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // Attach the verified user. `user.id` = Supabase auth.users UUID.
    req.user = user;
    // Also attach the raw token so downstream code can build user-scoped
    // Supabase clients if needed.
    req.supabaseAccessToken = token;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = { platformAuth };
