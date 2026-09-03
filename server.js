const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('./config');
const { initializeDatabase } = require('./database/init');
const authRoutes = require('./routes/auth.routes');
const srsRoutes = require('./routes/srs.routes');
const { progressRouter, achievementsRouter } = require('./routes/progress.routes');
const planRoutes = require('./routes/plan.routes');
const contentRoutes = require('./routes/content.routes');
const settingsRoutes = require('./routes/settings.routes');
const curriculumRoutes = require('./routes/curriculum.routes');
const adminRoutes = require('./routes/admin.routes');
const { authMiddleware } = require('./middleware/auth.middleware');
const platformRoutes = require('./routes/platform.routes');
const webhookRoutes = require('./routes/webhooks.routes');
const previewRoutes = require('./routes/preview.routes');
const platformConfig = require('./config.platform');

/**
 * Module-level database reference.
 * Initialized when createServer() is called.
 */
let db = null;

/**
 * Returns the current database instance.
 * @returns {object} The database wrapper instance
 */
function getDb() {
  return db;
}

/**
 * Creates and configures the Express application.
 * Initializes the database before mounting routes.
 * 
 * @param {object} [options] - Optional configuration
 * @param {string} [options.dbPath] - Override database path (useful for testing)
 * @returns {Promise<object>} The Express app instance
 */
async function createServer(options = {}) {
  // Initialize database before anything else (async for sql.js)
  db = await initializeDatabase(options.dbPath);

  const app = express();

  // Make db accessible via app.locals for route handlers
  app.locals.db = db;

  // Payment webhooks MUST be mounted before express.json(), because signature
  // verification needs the exact raw request body. This router uses its own
  // express.raw() parser and is public (verified by provider signature).
  if (platformConfig.isConfigured()) {
    app.use('/api/webhooks', webhookRoutes);
  }

  // Middleware
  app.use(express.json());
  app.use(cookieParser());

  // Static file serving from public/ directory (no cache for development)
  app.use(express.static(path.join(__dirname, 'public'), {
    etag: false,
    lastModified: false,
    setHeaders: (res) => {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
  }));

  // Health check endpoint (public)
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Auth routes (public - no middleware required)
  app.use('/api/auth', authRoutes);

  // Admin routes (protected by admin key, not user auth)
  app.use('/api/admin', adminRoutes);

  // Platform routes (Supabase Auth; public + protected, mounted before the
  // legacy auth gate so they use their own middleware).
  if (platformConfig.isConfigured()) {
    app.use('/api/platform', platformRoutes);
    console.log('[platform] Supabase-backed platform routes mounted at /api/platform');
  } else {
    platformConfig.reportMissing();
    console.log('[platform] Platform routes NOT mounted (missing config). Legacy-only mode.');
  }

  // Public "Test before paying" preview routes: serve ONLY the allowlisted
  // free-sample content without auth. Mounted BEFORE the legacy auth gate;
  // non-preview items fall through (next()) to the authed routes below.
  app.use('/api', previewRoutes);

  // Protect all other /api/ routes with legacy auth middleware
  app.use('/api', authMiddleware);

  // Protected API routes
  app.use('/api/srs', srsRoutes);
  app.use('/api/progress', progressRouter);
  app.use('/api/achievements', achievementsRouter);
  app.use('/api/plan', planRoutes);
  app.use('/api', contentRoutes);
  app.use('/api', settingsRoutes);
  app.use('/api/curriculum', curriculumRoutes);

  // Fallback: serve index.html for SPA routing
  app.get('*', (req, res, next) => {
    // Only serve index.html for non-API routes
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  return app;
}

module.exports = { createServer, getDb };
