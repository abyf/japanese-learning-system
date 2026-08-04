const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');

const SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 4;

/**
 * Hashes a plaintext password using bcrypt.
 * @param {string} plainPassword - The plaintext password to hash
 * @returns {Promise<string>} The bcrypt hash
 */
async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Verifies a plaintext password against a bcrypt hash.
 * @param {string} plainPassword - The plaintext password
 * @param {string} hash - The bcrypt hash to verify against
 * @returns {Promise<boolean>} True if the password matches
 */
async function verifyPassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

/**
 * Issues a signed JWT token containing the userId.
 * @param {number} userId - The user ID to encode in the token
 * @returns {string} The signed JWT string
 */
function issueToken(userId) {
  return jwt.sign({ userId }, config.jwtSecret, {
    expiresIn: '7d'
  });
}

/**
 * Verifies and decodes a JWT token.
 * @param {string} token - The JWT string to verify
 * @returns {{ userId: number, iat: number, exp: number }} Decoded payload
 * @throws {Error} If the token is invalid or expired
 */
function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

/**
 * Registers a new user account.
 * Validates username uniqueness and password length (min 4 chars).
 * Creates a settings record for the new user.
 * 
 * @param {import('better-sqlite3').Database} db - The database instance
 * @param {string} username - Desired username
 * @param {string} password - Desired password (minimum 4 characters)
 * @returns {Promise<{ userId: number, token: string }>} The new user ID and JWT token
 * @throws {Error} If validation fails or username is taken
 */
async function register(db, username, password, email) {
  // Validate inputs
  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    throw new Error('Username is required');
  }

  if (!password || typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const trimmedUsername = username.trim();

  // Check username uniqueness
  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(trimmedUsername);
  if (existingUser) {
    throw new Error('Username already exists');
  }

  // Hash password and create user
  const passwordHash = await hashPassword(password);

  const insertUser = db.prepare(
    'INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)'
  );
  const result = insertUser.run(trimmedUsername, passwordHash, email || '');
  const userId = result.lastInsertRowid;

  // Create default settings record for the new user
  const insertSettings = db.prepare(
    'INSERT OR IGNORE INTO settings (user_id) VALUES (?)'
  );
  insertSettings.run(userId);

  // Issue token
  const token = issueToken(userId);

  return { userId: Number(userId), token };
}

/**
 * Authenticates a user with username and password.
 * Returns a generic error message on failure to avoid revealing which field is incorrect.
 * 
 * @param {import('better-sqlite3').Database} db - The database instance
 * @param {string} username - The username
 * @param {string} password - The password
 * @returns {Promise<{ userId: number, token: string }>} The user ID and JWT token
 * @throws {Error} "Invalid username or password" on failure
 */
async function login(db, username, password) {
  const genericError = 'Invalid username or password';

  if (!username || !password) {
    throw new Error(genericError);
  }

  // Look up user
  const user = db.prepare('SELECT id, password_hash FROM users WHERE username = ?').get(username.trim());
  if (!user) {
    throw new Error(genericError);
  }

  // Verify password
  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    throw new Error(genericError);
  }

  // Issue token
  const token = issueToken(user.id);

  return { userId: user.id, token };
}

module.exports = {
  hashPassword,
  verifyPassword,
  issueToken,
  verifyToken,
  register,
  login
};
