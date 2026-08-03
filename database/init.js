const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const config = require('../config');

/**
 * Current schema version. Increment when adding migrations.
 */
const CURRENT_SCHEMA_VERSION = 4;

/**
 * Full schema for initial database creation (version 1).
 */
const SCHEMA_V1 = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    current_level TEXT NOT NULL DEFAULT 'beginner',
    theme TEXT NOT NULL DEFAULT 'light',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- SRS card state (SM-2 parameters per user per card)
CREATE TABLE IF NOT EXISTS srs_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    card_id TEXT NOT NULL,
    level TEXT NOT NULL,
    interval REAL NOT NULL DEFAULT 0,
    ease_factor REAL NOT NULL DEFAULT 2.5,
    repetition_count INTEGER NOT NULL DEFAULT 0,
    next_review_date TEXT NOT NULL,
    times_reviewed INTEGER NOT NULL DEFAULT 0,
    times_correct INTEGER NOT NULL DEFAULT 0,
    times_incorrect INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, card_id)
);

-- Progress records per activity per level
CREATE TABLE IF NOT EXISTS progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    activity_type TEXT NOT NULL,
    level TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    score REAL NOT NULL,
    duration_seconds INTEGER NOT NULL,
    completed_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, activity_type, level, exercise_id, completed_at)
);

-- Daily difficulty scores for adaptive system
CREATE TABLE IF NOT EXISTS difficulty_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    activity_type TEXT NOT NULL,
    level TEXT NOT NULL,
    score REAL NOT NULL DEFAULT 0.5,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, activity_type, level)
);

-- Daily plans
CREATE TABLE IF NOT EXISTS daily_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    plan_date TEXT NOT NULL,
    plan_data TEXT NOT NULL,
    estimated_minutes INTEGER NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, plan_date)
);

-- Achievements
CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    achievement_key TEXT NOT NULL,
    earned_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, achievement_key)
);

-- Study streaks
CREATE TABLE IF NOT EXISTS study_days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    study_date TEXT NOT NULL,
    total_seconds INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, study_date)
);

-- User settings
CREATE TABLE IF NOT EXISTS settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    new_cards_per_day INTEGER NOT NULL DEFAULT 10,
    session_duration_target INTEGER NOT NULL DEFAULT 25,
    theme TEXT NOT NULL DEFAULT 'light',
    furigana_default INTEGER NOT NULL DEFAULT 1,
    language TEXT NOT NULL DEFAULT 'en'
);

-- Curriculum progress tracking
CREATE TABLE IF NOT EXISTS curriculum_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    week INTEGER NOT NULL,
    day INTEGER NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    UNIQUE(user_id, week, day)
);

-- External activity completion tracking
CREATE TABLE IF NOT EXISTS external_activity_done (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    week INTEGER NOT NULL,
    day INTEGER NOT NULL,
    activity_index INTEGER NOT NULL,
    completed_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, week, day, activity_index)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_srs_state_user_due ON srs_state(user_id, next_review_date);
CREATE INDEX IF NOT EXISTS idx_progress_user_activity ON progress(user_id, activity_type, level);
CREATE INDEX IF NOT EXISTS idx_study_days_user ON study_days(user_id, study_date);
CREATE INDEX IF NOT EXISTS idx_daily_plans_user_date ON daily_plans(user_id, plan_date);
CREATE INDEX IF NOT EXISTS idx_curriculum_progress_user ON curriculum_progress(user_id, week, day);
`;

/**
 * Migration definitions. Add new migrations here as the schema evolves.
 */
const MIGRATIONS = [
  { version: 2, sql: "ALTER TABLE settings ADD COLUMN language TEXT NOT NULL DEFAULT 'en';" },
  { version: 3, sql: "CREATE TABLE IF NOT EXISTS curriculum_progress (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), week INTEGER NOT NULL, day INTEGER NOT NULL, completed INTEGER NOT NULL DEFAULT 0, completed_at TEXT, UNIQUE(user_id, week, day)); CREATE INDEX IF NOT EXISTS idx_curriculum_progress_user ON curriculum_progress(user_id, week, day);" },
  { version: 4, sql: "CREATE TABLE IF NOT EXISTS external_activity_done (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), week INTEGER NOT NULL, day INTEGER NOT NULL, activity_index INTEGER NOT NULL, completed_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(user_id, week, day, activity_index));" }
];

/**
 * Wraps a sql.js Database to provide a better-sqlite3-compatible API.
 * This allows the rest of the codebase to use .prepare().get()/.all()/.run()
 * without modification.
 */
class DatabaseWrapper {
  constructor(sqlJsDb, dbPath) {
    this._db = sqlJsDb;
    this._dbPath = dbPath;
    this._saveInterval = null;
    this._dirty = false;

    // Auto-save every 5 seconds if there are changes
    this._saveInterval = setInterval(() => {
      if (this._dirty) {
        this._saveToDisk();
        this._dirty = false;
      }
    }, 5000);
  }

  /**
   * Executes raw SQL (multiple statements allowed).
   */
  exec(sql) {
    this._db.run(sql);
    this._dirty = true;
  }

  /**
   * Gets/sets PRAGMA values.
   * Supports: pragma('user_version', { simple: true }) and pragma('user_version = N')
   */
  pragma(pragmaStr, options) {
    if (pragmaStr.includes('=')) {
      // Setting a pragma value
      this._db.run(`PRAGMA ${pragmaStr}`);
      this._dirty = true;
      return;
    }
    // Getting a pragma value
    const result = this._db.exec(`PRAGMA ${pragmaStr}`);
    if (result.length === 0 || result[0].values.length === 0) {
      return options && options.simple ? 0 : [];
    }
    if (options && options.simple) {
      return result[0].values[0][0];
    }
    return result[0].values;
  }

  /**
   * Prepares a statement — returns an object with .get(), .all(), .run() methods.
   * Compatible with better-sqlite3 API.
   */
  prepare(sql) {
    const db = this._db;
    const wrapper = this;

    return {
      /**
       * Returns the first row as an object, or undefined if no results.
       */
      get(...params) {
        const stmt = db.prepare(sql);
        stmt.bind(params.length > 0 ? params : undefined);
        if (stmt.step()) {
          const columns = stmt.getColumnNames();
          const values = stmt.get();
          const row = {};
          for (let i = 0; i < columns.length; i++) {
            row[columns[i]] = values[i];
          }
          stmt.free();
          return row;
        }
        stmt.free();
        return undefined;
      },

      /**
       * Returns all matching rows as an array of objects.
       */
      all(...params) {
        const stmt = db.prepare(sql);
        stmt.bind(params.length > 0 ? params : undefined);
        const results = [];
        const columns = stmt.getColumnNames();
        while (stmt.step()) {
          const values = stmt.get();
          const row = {};
          for (let i = 0; i < columns.length; i++) {
            row[columns[i]] = values[i];
          }
          results.push(row);
        }
        stmt.free();
        return results;
      },

      /**
       * Executes a statement (INSERT/UPDATE/DELETE) and returns info.
       */
      run(...params) {
        const stmt = db.prepare(sql);
        stmt.bind(params.length > 0 ? params : undefined);
        stmt.step();
        stmt.free();
        wrapper._dirty = true;
        return {
          changes: db.getRowsModified(),
          lastInsertRowid: wrapper._getLastInsertRowId()
        };
      }
    };
  }

  /**
   * Executes a function within a transaction.
   * If the function throws, the transaction is rolled back.
   */
  transaction(fn) {
    return (...args) => {
      this._db.run('BEGIN TRANSACTION');
      try {
        const result = fn(...args);
        this._db.run('COMMIT');
        this._dirty = true;
        return result;
      } catch (err) {
        this._db.run('ROLLBACK');
        throw err;
      }
    };
  }

  /**
   * Saves the database to disk immediately.
   */
  save() {
    this._saveToDisk();
    this._dirty = false;
  }

  /**
   * Closes the database and saves to disk.
   */
  close() {
    if (this._saveInterval) {
      clearInterval(this._saveInterval);
      this._saveInterval = null;
    }
    this._saveToDisk();
    this._db.close();
  }

  _saveToDisk() {
    if (!this._dbPath) return; // In-memory only
    const data = this._db.export();
    const buffer = Buffer.from(data);
    const dir = path.dirname(this._dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this._dbPath, buffer);
  }

  _getLastInsertRowId() {
    const result = this._db.exec('SELECT last_insert_rowid() as id');
    if (result.length > 0 && result[0].values.length > 0) {
      return result[0].values[0][0];
    }
    return 0;
  }
}

/**
 * Initializes the SQLite database using sql.js (pure JavaScript, no native deps).
 * Creates the database file if it doesn't exist, runs the full schema on first
 * creation, and applies any pending migrations.
 * 
 * @param {string} [dbPath] - Optional path override (useful for testing)
 * @returns {Promise<DatabaseWrapper>} The initialized database wrapper
 */
async function initializeDatabase(dbPath) {
  const resolvedPath = dbPath || config.databasePath;

  // Initialize sql.js
  const SQL = await initSqlJs();

  let db;

  // Load existing database file if it exists
  if (resolvedPath && fs.existsSync(resolvedPath)) {
    const fileBuffer = fs.readFileSync(resolvedPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  const wrapper = new DatabaseWrapper(db, resolvedPath);

  // Enable foreign keys
  wrapper.pragma('foreign_keys = ON');

  const currentVersion = wrapper.pragma('user_version', { simple: true });

  if (currentVersion === 0) {
    // Fresh database — run full schema
    wrapper.exec(SCHEMA_V1);
    wrapper.pragma(`user_version = ${CURRENT_SCHEMA_VERSION}`);
  } else if (currentVersion < CURRENT_SCHEMA_VERSION) {
    // Run pending migrations
    const pending = MIGRATIONS.filter(m => m.version > currentVersion);
    for (const migration of pending) {
      wrapper.exec(migration.sql);
    }
    wrapper.pragma(`user_version = ${CURRENT_SCHEMA_VERSION}`);
  }

  // Save initial state to disk
  wrapper.save();

  return wrapper;
}

module.exports = { initializeDatabase, CURRENT_SCHEMA_VERSION };
