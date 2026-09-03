/**
 * Platform Routes (Task 3.3 + Tasks 5–8)
 *
 * All routes under /api/platform. Public routes (catalog, preview, webhooks)
 * do not require auth. Protected routes use platformAuth middleware.
 *
 * Currently implements:
 *   GET  /api/platform/me             - profile + entitlements (auth required)
 *   GET  /api/platform/config         - public client config (Supabase URL, anon key, etc.)
 *
 * Future (Tasks 5-8):
 *   GET  /api/platform/catalog
 *   GET  /api/platform/courses/:id/preview
 *   GET  /api/platform/courses/:id/content
 *   POST /api/platform/checkout
 *   GET  /api/platform/billing/portal
 *   GET  /api/platform/me/entitlements
 *   GET  /api/platform/me/progress/:courseId
 *   PUT  /api/platform/me/progress/:courseId
 *   POST /api/platform/webhooks/:provider
 */

'use strict';

const express = require('express');
const { platformAuth } = require('../middleware/platform-auth.middleware');
const { getAdminClient } = require('../lib/supabase');
const platformConfig = require('../config.platform');
const { getEntitlements } = require('../modules/entitlements');
const { listCatalog, getPreview, getCourseContent } = require('../modules/catalog');
const { getAdapter } = require('../modules/payments');

const router = express.Router();

// ─── Public routes (no auth) ────────────────────────────────────────────────

/**
 * GET /api/platform/config
 * Returns non-secret platform config for the browser (Supabase URL, anon key,
 * Paddle client token/env). Never includes service-role or API secrets.
 */
router.get('/config', (req, res) => {
  res.json(platformConfig.publicConfig());
});

// ─── Protected routes (Supabase auth required) ─────────────────────────────

/**
 * GET /api/platform/me
 * Returns the authenticated user's profile (from the profiles table) plus
 * their entitlements. This is the first call the SPA makes after login.
 */
router.get('/me', platformAuth, async (req, res) => {
  try {
    const admin = getAdminClient();

    // Profile
    const { data: profile, error: profErr } = await admin
      .from('profiles')
      .select('id, display_name, created_at')
      .eq('id', req.user.id)
      .single();

    if (profErr && profErr.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Profile fetch error:', profErr.message);
    }

    // Entitlements
    const { data: entitlements, error: entErr } = await admin
      .from('entitlements')
      .select('id, course_id, all_access, status, plan_type, current_period_end')
      .eq('user_id', req.user.id);

    if (entErr) {
      console.error('Entitlements fetch error:', entErr.message);
    }

    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        displayName: profile ? profile.display_name : null,
        createdAt: profile ? profile.created_at : null,
      },
      entitlements: entitlements || [],
    });
  } catch (err) {
    console.error('GET /api/platform/me error:', err.message);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// ─── Catalog & Content (public + gated) ─────────────────────────────────────

/**
 * GET /api/platform/catalog
 * Public. Returns all published courses with their active prices.
 */
router.get('/catalog', async (req, res) => {
  try {
    const catalog = await listCatalog();
    res.json({ courses: catalog });
  } catch (err) {
    console.error('GET /catalog error:', err.message);
    res.status(500).json({ error: 'Failed to load catalog' });
  }
});

/**
 * GET /api/platform/courses/:id/preview
 * Public. Returns the "Test before paying" taster (one exercise per section).
 */
router.get('/courses/:id/preview', async (req, res) => {
  try {
    const preview = await getPreview(req.params.id);
    res.json({ courseId: req.params.id, preview: preview });
  } catch (err) {
    console.error('GET /preview error:', err.message);
    res.status(500).json({ error: 'Failed to load preview' });
  }
});

/**
 * GET /api/platform/courses/:id/content
 * Auth required. Returns full content if entitled; 402 paywall if not.
 */
router.get('/courses/:id/content', platformAuth, async (req, res) => {
  try {
    const content = await getCourseContent(req.params.id, req.user.id);
    res.json({ courseId: req.params.id, content: content });
  } catch (err) {
    if (err.status === 402) {
      return res.status(402).json({
        error: 'subscription_required',
        message: 'An active subscription is required to access this content.',
        courseId: req.params.id
      });
    }
    console.error('GET /content error:', err.message);
    res.status(500).json({ error: 'Failed to load content' });
  }
});

// ─── User data (auth required) ──────────────────────────────────────────────

/**
 * GET /api/platform/me/entitlements
 * Returns the user's entitlements (what courses they have access to).
 */
router.get('/me/entitlements', platformAuth, async (req, res) => {
  try {
    const ents = await getEntitlements(req.user.id);
    res.json({ entitlements: ents });
  } catch (err) {
    console.error('GET /me/entitlements error:', err.message);
    res.status(500).json({ error: 'Failed to load entitlements' });
  }
});

/**
 * GET /api/platform/me/progress/:courseId
 * Returns the user's progress for a course.
 */
router.get('/me/progress/:courseId', platformAuth, async (req, res) => {
  try {
    const { data, error } = await getAdminClient()
      .from('progress')
      .select('data, updated_at')
      .eq('user_id', req.user.id)
      .eq('course_id', req.params.courseId)
      .maybeSingle();
    if (error) throw error;
    res.json({ courseId: req.params.courseId, progress: data ? data.data : null, updatedAt: data ? data.updated_at : null });
  } catch (err) {
    console.error('GET /me/progress error:', err.message);
    res.status(500).json({ error: 'Failed to load progress' });
  }
});

/**
 * PUT /api/platform/me/progress/:courseId
 * Save/update the user's progress for a course.
 */
router.put('/me/progress/:courseId', platformAuth, async (req, res) => {
  try {
    const { data: progressData } = req.body;
    if (progressData === undefined) {
      return res.status(400).json({ error: 'Missing "data" in request body' });
    }
    const { error } = await getAdminClient()
      .from('progress')
      .upsert({
        user_id: req.user.id,
        course_id: req.params.courseId,
        data: progressData,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,course_id' });
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /me/progress error:', err.message);
    res.status(500).json({ error: 'Failed to save progress' });
  }
});

// ─── Checkout & Billing (auth required) ─────────────────────────────────────

/**
 * POST /api/platform/checkout
 * Body: { courseId, planType }
 * Looks up the active price for (course, plan), then creates a provider
 * checkout carrying custom_data {userId, courseId, planType} so the webhook
 * can grant the right entitlement. Returns the checkout URL / transaction id.
 */
router.post('/checkout', platformAuth, async (req, res) => {
  try {
    const { courseId, planType } = req.body || {};
    if (!courseId || !planType) {
      return res.status(400).json({ error: 'courseId and planType are required' });
    }
    if (['monthly', 'annual', 'lifetime'].indexOf(planType) === -1) {
      return res.status(400).json({ error: 'Invalid planType' });
    }

    const admin = getAdminClient();

    // Find the active price for this course + plan + current provider.
    const { data: price, error: priceErr } = await admin
      .from('prices')
      .select('provider_price_id, provider, amount_cents, currency')
      .eq('course_id', courseId)
      .eq('plan_type', planType)
      .eq('is_active', true)
      .maybeSingle();

    if (priceErr) throw priceErr;
    if (!price || !price.provider_price_id) {
      return res.status(409).json({
        error: 'price_unavailable',
        message: 'This plan is not available for purchase yet (provider price not configured).'
      });
    }

    const adapter = getAdapter();
    const successUrl = platformConfig.publicBaseUrl + '/#/course/' + encodeURIComponent(courseId);

    const result = await adapter.createCheckout({
      userId: req.user.id,
      email: req.user.email,
      courseId: courseId,
      planType: planType,
      providerPriceId: price.provider_price_id,
      successUrl: successUrl
    });

    res.json({
      provider: adapter.name,
      transactionId: result.transactionId || null,
      url: result.url || null
    });
  } catch (err) {
    console.error('POST /checkout error:', err.message);
    res.status(500).json({ error: 'Failed to create checkout', detail: err.message });
  }
});

/**
 * GET /api/platform/billing/portal
 * Returns a provider customer-portal URL for managing/canceling subscriptions.
 * Uses the provider_customer_id from any of the user's entitlements.
 */
router.get('/billing/portal', platformAuth, async (req, res) => {
  try {
    const { data: ents, error } = await getAdminClient()
      .from('entitlements')
      .select('provider, provider_customer_id')
      .eq('user_id', req.user.id)
      .not('provider_customer_id', 'is', null)
      .limit(1);
    if (error) throw error;
    if (!ents || !ents.length) {
      return res.status(404).json({ error: 'no_subscription', message: 'No subscription to manage.' });
    }
    const adapter = getAdapter();
    const result = await adapter.getPortalUrl({ providerCustomerId: ents[0].provider_customer_id });
    res.json({ url: result.url });
  } catch (err) {
    console.error('GET /billing/portal error:', err.message);
    res.status(500).json({ error: 'Failed to get billing portal' });
  }
});

module.exports = router;
