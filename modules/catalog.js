/**
 * Catalog & Course Content Service (Task 6.1)
 *
 * Serves the public catalog, the "Test before paying" preview, and gated
 * content for entitled users.
 *
 * Public reads (catalog, preview) use the admin client with explicit filters
 * rather than the anon key, because the admin client is already available and
 * these are simple, non-user-scoped reads. For gated content, the admin client
 * is required (RLS blocks anon/user reads of non-preview rows).
 */

'use strict';

const { getAdminClient } = require('../lib/supabase');
const { hasActiveAccess } = require('./entitlements');

/**
 * List the public catalog: published courses with their active prices.
 * @returns {Promise<Array>} courses with nested prices array
 */
async function listCatalog() {
  const admin = getAdminClient();

  const { data: courses, error: cErr } = await admin
    .from('courses')
    .select('id, title, language, level, description, sort_order')
    .eq('is_published', true)
    .order('sort_order', { ascending: true });

  if (cErr) throw new Error('Catalog query failed: ' + cErr.message);

  const { data: prices, error: pErr } = await admin
    .from('prices')
    .select('course_id, plan_type, amount_cents, currency, provider_price_id')
    .eq('is_active', true);

  if (pErr) throw new Error('Prices query failed: ' + pErr.message);

  // Nest prices under their course.
  var pricesByCourse = {};
  (prices || []).forEach(function(p) {
    if (!pricesByCourse[p.course_id]) pricesByCourse[p.course_id] = [];
    pricesByCourse[p.course_id].push({
      planType: p.plan_type,
      amountCents: p.amount_cents,
      currency: p.currency,
      providerPriceId: p.provider_price_id
    });
  });

  return (courses || []).map(function(c) {
    return {
      id: c.id,
      title: c.title,
      language: c.language,
      level: c.level,
      description: c.description,
      prices: pricesByCourse[c.id] || []
    };
  });
}

/**
 * Get the "Test before paying" preview for a course: one exercise per section.
 * Returns only rows where is_preview = true.
 * @param {string} courseId
 * @returns {Promise<Array>}
 */
async function getPreview(courseId) {
  const { data, error } = await getAdminClient()
    .from('course_content')
    .select('id, kind, ref, data, sort_order')
    .eq('course_id', courseId)
    .eq('is_preview', true)
    .order('sort_order', { ascending: true });

  if (error) throw new Error('Preview query failed: ' + error.message);
  return data || [];
}

/**
 * Get full course content for an entitled user.
 * Throws if the user does not have an active entitlement.
 * @param {string} courseId
 * @param {string} userId - verified Supabase user UUID
 * @returns {Promise<Array>}
 */
async function getCourseContent(courseId, userId) {
  var access = await hasActiveAccess(userId, courseId);
  if (!access) {
    var err = new Error('Active subscription required');
    err.status = 402;
    throw err;
  }

  const { data, error } = await getAdminClient()
    .from('course_content')
    .select('id, kind, ref, data, is_preview, sort_order')
    .eq('course_id', courseId)
    .order('sort_order', { ascending: true });

  if (error) throw new Error('Content query failed: ' + error.message);
  return data || [];
}

module.exports = { listCatalog, getPreview, getCourseContent };
