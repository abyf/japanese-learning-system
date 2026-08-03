const path = require('path');

/**
 * Application configuration.
 * Uses Electron's app.getPath('userData') for platform-appropriate data directory:
 *   - Windows: %APPDATA%/japanese-learning-system
 *   - macOS:   ~/Library/Application Support/japanese-learning-system
 *   - Linux:   ~/.config/japanese-learning-system
 */

let userDataPath;

try {
  const { app } = require('electron');
  userDataPath = app.getPath('userData');
} catch (e) {
  // Fallback for running without Electron (e.g., testing)
  userDataPath = path.join(
    process.env.APPDATA ||
    (process.platform === 'darwin'
      ? path.join(process.env.HOME, 'Library', 'Application Support')
      : path.join(process.env.HOME, '.config')),
    'japanese-learning-system'
  );
}

const config = {
  // Server
  defaultPort: 3000,

  // Authentication
  jwtSecret: process.env.JWT_SECRET || 'jls-local-secret-key-change-in-production',
  cookieExpiration: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  cookieMaxAge: 7 * 24 * 60 * 60 * 1000,

  // Paths
  userDataPath: userDataPath,
  databasePath: path.join(userDataPath, 'japanese-learning.db'),
  contentPath: path.join(__dirname, 'content'),

  // SRS defaults
  newCardsPerDay: 10,
  sessionDurationTarget: 25, // minutes

  // Window
  minWindowWidth: 768,
  minWindowHeight: 600
};

module.exports = config;
