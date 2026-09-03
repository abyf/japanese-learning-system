/**
 * Learning Platform configuration (Task 2.2)
 *
 * Centralizes all environment-driven settings for the paid multi-course
 * platform: Supabase, the payment provider (Paddle first), and the public base
 * URL used for checkout redirects and webhooks.
 *
 * Secrets are read from environment variables only (local `.env` in dev, Render
 * env vars in production) and are NEVER committed or sent to the browser.
 *
 * Only a small, explicitly safe subset is exposed to the client via
 * `publicConfig()` (Supabase URL + anon key + provider public bits).
 */

'use strict';

// Load .env in non-production if present (dotenv is a no-op if the file is absent).
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not installed / not needed in some environments — ignore.
}

function required(name) {
  const v = process.env[name];
  if (!v) return { name, value: undefined, missing: true };
  return { name, value: v, missing: false };
}

const platformConfig = {
  // ── Supabase ──────────────────────────────────────────────────────────
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  // Server-only. Bypasses RLS. Never expose to the client.
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // ── Payments (provider-neutral) ───────────────────────────────────────
  paymentProvider: (process.env.PAYMENT_PROVIDER || 'paddle').toLowerCase(),
  paddle: {
    apiKey: process.env.PADDLE_API_KEY || '',            // secret, server-only
    webhookSecret: process.env.PADDLE_WEBHOOK_SECRET || '', // secret, server-only
    clientToken: process.env.PADDLE_CLIENT_TOKEN || '',  // safe for client (Paddle.js)
    environment: (process.env.PADDLE_ENV || 'sandbox').toLowerCase(), // 'sandbox' | 'production'
  },

  // ── App ───────────────────────────────────────────────────────────────
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:3000',

  // Whether the platform (paid) layer is configured enough to run.
  isConfigured() {
    return Boolean(
      platformConfig.supabaseUrl &&
      platformConfig.supabaseAnonKey &&
      platformConfig.supabaseServiceRoleKey
    );
  },

  /**
   * Returns ONLY values that are safe to send to the browser.
   * (Never includes service role key or provider secrets.)
   */
  publicConfig() {
    return {
      supabaseUrl: platformConfig.supabaseUrl,
      supabaseAnonKey: platformConfig.supabaseAnonKey,
      paymentProvider: platformConfig.paymentProvider,
      paddleClientToken: platformConfig.paddle.clientToken,
      paddleEnvironment: platformConfig.paddle.environment,
    };
  },

  /**
   * Logs which required env vars are missing (names only, never values).
   * Useful on startup to catch misconfiguration early.
   */
  reportMissing() {
    const checks = [
      required('SUPABASE_URL'),
      required('SUPABASE_ANON_KEY'),
      required('SUPABASE_SERVICE_ROLE_KEY'),
    ];
    if (platformConfig.paymentProvider === 'paddle') {
      checks.push(required('PADDLE_API_KEY'), required('PADDLE_WEBHOOK_SECRET'));
    }
    const missing = checks.filter((c) => c.missing).map((c) => c.name);
    if (missing.length) {
      console.warn('[platform] Missing env vars (platform features disabled):', missing.join(', '));
    }
    return missing;
  },
};

module.exports = platformConfig;
