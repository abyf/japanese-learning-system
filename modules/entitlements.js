/**
 * Entitlement Service (Task 5.1)
 *
 * The single gate that controls access to paid course content. All access
 * decisions go through `hasActiveAccess(userId, courseId)`.
 *
 * Entitlements are written ONLY by the backend (service role) in response to
 * verified payment webhooks. They are never writable from the browser.
 *
 * Status semantics:
 *   active   + (lifetime OR current_period_end in the future) → access granted
 *   canceled → access until current_period_end, then denied
 *   expired / refunded → denied immediately
 *   past_due → grace: treat as active for a short window, then deny
 */

'use strict';

const { getAdminClient } = require('../lib/supabase');

/**
 * Get all entitlements for a user.
 * @param {string} userId - Supabase auth user UUID
 * @returns {Promise<Array>}
 */
async function getEntitlements(userId) {
  const { data, error } = await getAdminClient()
    .from('entitlements')
    .select('*')
    .eq('user_id', userId);
  if (error) throw new Error('Failed to fetch entitlements: ' + error.message);
  return data || [];
}

/**
 * Check whether a user has active access to a specific course (or all-access).
 *
 * Active means:
 *   - status = 'active' (or 'canceled' with future period end)
 *   - AND (plan_type = 'lifetime' OR current_period_end > now)
 *
 * @param {string} userId
 * @param {string} courseId
 * @returns {Promise<boolean>}
 */
async function hasActiveAccess(userId, courseId) {
  const now = new Date().toISOString();
  const { data, error } = await getAdminClient()
    .from('entitlements')
    .select('id, status, plan_type, current_period_end, all_access, course_id')
    .eq('user_id', userId);

  if (error || !data || data.length === 0) return false;

  return data.some(function(e) {
    // Must match the course (or be all-access)
    if (!e.all_access && e.course_id !== courseId) return false;

    // Status check
    var statusOk = (e.status === 'active' || e.status === 'canceled' || e.status === 'past_due');
    if (!statusOk) return false;

    // Lifetime = non-expiring
    if (e.plan_type === 'lifetime') return true;

    // Recurring: current_period_end must be in the future
    if (e.current_period_end && new Date(e.current_period_end) > new Date(now)) return true;

    return false;
  });
}

/**
 * Create or update an entitlement from a verified payment event.
 * Called by the webhook handler with a MappedEvent.
 *
 * Uses the service role (bypasses RLS). Upserts by (user_id, course_id, provider).
 *
 * @param {object} mapped - MappedEvent from the payment adapter
 */
async function upsertEntitlementFromPayment(mapped) {
  const admin = getAdminClient();

  var row = {
    user_id: mapped.userId,
    course_id: mapped.courseId || null,
    all_access: mapped.allAccess || false,
    status: mapped.status || 'active',
    source: 'purchase',
    plan_type: mapped.planType || null,
    provider: mapped.provider,
    provider_customer_id: mapped.providerCustomerId || null,
    provider_subscription_id: mapped.providerSubscriptionId || null,
    provider_price_id: mapped.providerPriceId || null,
    current_period_end: mapped.currentPeriodEnd || null,
    updated_at: new Date().toISOString()
  };

  // Upsert: if (user_id, course_id, provider) exists → update; else insert.
  var { error } = await admin
    .from('entitlements')
    .upsert(row, { onConflict: 'user_id,course_id,provider' });

  if (error) throw new Error('Entitlement upsert failed: ' + error.message);
}

/**
 * Revoke an entitlement (set status to the given value).
 * Used for cancellations, refunds, expirations.
 */
async function revokeEntitlement(userId, courseId, provider, newStatus) {
  var { error } = await getAdminClient()
    .from('entitlements')
    .update({ status: newStatus || 'expired', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .eq('provider', provider);

  if (error) throw new Error('Entitlement revoke failed: ' + error.message);
}

module.exports = {
  getEntitlements,
  hasActiveAccess,
  upsertEntitlementFromPayment,
  revokeEntitlement
};
