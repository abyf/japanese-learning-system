/**
 * Payment Webhook Handler (Task 8.1)
 *
 * POST /api/webhooks/:provider
 *
 * Flow (per the design):
 *   1. Verify the provider signature over the RAW body (spoof protection).
 *   2. Parse the event into a provider-neutral MappedEvent.
 *   3. Dedupe by provider event id in payment_events (idempotency).
 *   4. Apply the entitlement effect (grant / update / revoke).
 *   5. Record the payment_event with a status ('processed'|'unmatched'|'error').
 *
 * IMPORTANT: this route needs the RAW request body for signature verification,
 * so it must be mounted with express.raw() BEFORE express.json() applies. We
 * handle that in server.js by mounting this router before the json middleware,
 * and using express.raw here.
 */

'use strict';

const express = require('express');
const { getAdapter } = require('../modules/payments');
const { getAdminClient } = require('../lib/supabase');
const { upsertEntitlementFromPayment, revokeEntitlement } = require('../modules/entitlements');

const router = express.Router();

// Raw body parser for this route only (needed for signature verification).
const rawParser = express.raw({ type: '*/*', limit: '1mb' });

/**
 * Idempotency + audit: store the event; returns true if it's new (first time).
 */
async function recordEvent(admin, mapped, status) {
  // Try to insert; if the id already exists, it's a duplicate.
  const { error } = await admin.from('payment_events').insert({
    id: mapped.providerEventId,
    provider: mapped.provider,
    event_name: mapped.eventName,
    payload: mapped.__raw || null,
    status: status
  });
  if (error) {
    // Unique violation => duplicate event (already processed).
    if (error.code === '23505') return false;
    // Other error: log but don't crash the webhook.
    console.error('[webhook] payment_events insert error:', error.message);
    return true; // proceed anyway; better to (idempotently) apply than to drop
  }
  return true;
}

router.post('/:provider', rawParser, async (req, res) => {
  const providerName = req.params.provider;
  let adapter;
  try {
    adapter = getAdapter();
  } catch (e) {
    return res.status(400).json({ error: 'Unknown provider' });
  }
  if (adapter.name !== providerName) {
    return res.status(400).json({ error: 'Provider mismatch' });
  }

  const raw = req.body; // Buffer (from express.raw)

  // 1. Verify signature over the raw body.
  let verified = false;
  try {
    verified = adapter.verifyWebhook(raw, req.headers);
  } catch (e) {
    verified = false;
  }
  if (!verified) {
    console.warn('[webhook] signature verification failed');
    return res.status(400).json({ error: 'invalid_signature' });
  }

  // 2. Parse into a neutral event.
  let mapped;
  try {
    mapped = adapter.parseEvent(raw, req.headers);
    mapped.__raw = JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw));
  } catch (e) {
    console.error('[webhook] parse error:', e.message);
    return res.status(200).json({ received: true, note: 'unparseable' });
  }

  const admin = getAdminClient();

  // 3. Idempotency: has this event id been seen?
  const { data: existing } = await admin
    .from('payment_events')
    .select('id')
    .eq('id', mapped.providerEventId)
    .maybeSingle();

  if (existing) {
    return res.status(200).json({ received: true, duplicate: true });
  }

  // 4. Apply the entitlement effect.
  try {
    if (mapped.action === 'none') {
      await recordEvent(admin, mapped, 'processed');
      return res.status(200).json({ received: true, action: 'none' });
    }

    // Must be able to resolve a user (and course, unless all-access) to act.
    if (!mapped.userId || (!mapped.courseId && !mapped.allAccess)) {
      await recordEvent(admin, mapped, 'unmatched');
      console.warn('[webhook] unmatched event (no user/course):', mapped.eventName, mapped.providerEventId);
      return res.status(200).json({ received: true, unmatched: true });
    }

    if (mapped.action === 'grant' || mapped.action === 'update') {
      await upsertEntitlementFromPayment(mapped);
    } else if (mapped.action === 'revoke') {
      await revokeEntitlement(mapped.userId, mapped.courseId, mapped.provider, mapped.status || 'canceled');
    }

    await recordEvent(admin, mapped, 'processed');
    return res.status(200).json({ received: true, action: mapped.action });
  } catch (err) {
    console.error('[webhook] processing error:', err.message);
    // Record as error; return 200 so the provider doesn't hammer retries forever,
    // but the stored event lets us reconcile/replay manually.
    try { await recordEvent(admin, mapped, 'error'); } catch (e) {}
    return res.status(200).json({ received: true, error: 'processing_failed' });
  }
});

module.exports = router;
