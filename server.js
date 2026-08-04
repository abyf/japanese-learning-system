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

  // Protect all other /api/ routes with auth middleware
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
