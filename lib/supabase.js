/**
 * Supabase client factory (Task 2.1)
 *
 * Two distinct clients, by design:
 *
 *   getUserClient(jwt)  - uses the ANON key plus the signed-in user's access
 *                         token. All queries run as the 'authenticated' role and
 *                         are subject to Row Level Security. Use for anything
 *                         done "on behalf of the user".
 *
 *   getAdminClient()    - uses the SERVICE_ROLE key, which BYPASSES RLS. Server
 *                         only. Use exclusively for privileged operations:
 *                         writing entitlements, writing payment_events, and
 *                         reading gated content to serve entitled users.
 *
 * The service-role key must never reach the browser.
 */

'use strict';

const { createClient } = require('@supabase/supabase-js');
const config = require('../config.platform');

let adminClient = null;

/**
 * Returns a cached service-role client (server-only, bypasses RLS).
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function getAdminClient() {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error('Supabase admin client not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing).');
  }
  if (!adminClient) {
    adminClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClient;
}

/**
 * Returns a per-request client scoped to a user's JWT. Queries respect RLS.
 * @param {string} jwt - the user's Supabase access token
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function getUserClient(jwt) {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error('Supabase not configured (SUPABASE_URL / SUPABASE_ANON_KEY missing).');
  }
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: jwt ? { headers: { Authorization: `Bearer ${jwt}` } } : {},
  });
}

/**
 * Verifies a Supabase access token and returns the user, or null.
 * Uses the admin client's auth API (getUser accepts a JWT).
 * @param {string} jwt
 * @returns {Promise<{id: string, email: string}|null>}
 */
async function getUserFromToken(jwt) {
  if (!jwt) return null;
  try {
    const { data, error } = await getAdminClient().auth.getUser(jwt);
    if (error || !data || !data.user) return null;
    return { id: data.user.id, email: data.user.email };
  } catch (e) {
    return null;
  }
}

module.exports = { getAdminClient, getUserClient, getUserFromToken };
