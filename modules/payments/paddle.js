/**
 * Paddle Billing adapter (Task 7.3)
 *
 * Implements the PaymentAdapter interface for Paddle Billing.
 *
 * - createCheckout: creates a transaction with the given price + custom_data
 *   ({userId, courseId, planType}) and returns a checkout URL. (We use the
 *   Paddle API to create a transaction, then hand its id to Paddle.js on the
 *   client, OR return a hosted checkout URL when available.)
 * - verifyWebhook: validates the `Paddle-Signature` header (HMAC-SHA256 over
 *   "<timestamp>:<rawBody>") against PADDLE_WEBHOOK_SECRET.
 * - parseEvent: maps Paddle event types to a provider-neutral MappedEvent.
 * - getPortalUrl: returns a customer portal session URL for managing subs.
 *
 * Docs: https://developer.paddle.com/
 */

'use strict';

const crypto = require('crypto');
const config = require('../../config.platform');

const API_BASE = config.paddle.environment === 'production'
  ? 'https://api.paddle.com'
  : 'https://sandbox-api.paddle.com';

function authHeaders() {
  return {
    'Authorization': 'Bearer ' + config.paddle.apiKey,
    'Content-Type': 'application/json'
  };
}

/**
 * Create a checkout for a price. Returns a transaction that the client's
 * Paddle.js opens, plus a hosted checkout URL if Paddle provides one.
 */
async function createCheckout(args) {
  // args: { userId, email, courseId, planType, providerPriceId, successUrl }
  if (!config.paddle.apiKey) {
    throw new Error('Paddle not configured (PADDLE_API_KEY missing).');
  }

  const body = {
    items: [{ price_id: args.providerPriceId, quantity: 1 }],
    custom_data: {
      user_id: args.userId,
      course_id: args.courseId,
      plan_type: args.planType
    }
  };

  // Only pass a per-transaction checkout return URL when it's an approved,
  // public HTTPS domain. For localhost/dev, omit it so Paddle uses the
  // account's Default Payment Link (which must be configured in the dashboard).
  if (args.successUrl && /^https:\/\//i.test(args.successUrl) && !/localhost|127\.0\.0\.1/i.test(args.successUrl)) {
    body.checkout = { url: args.successUrl };
  }

  // Attach customer email if we have it (helps prefill + matching).
  if (args.email) {
    body.customer = { email: args.email };
  }

  const res = await fetch(API_BASE + '/transactions', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body)
  });

  const json = await res.json();
  if (!res.ok) {
    const msg = (json && json.error && json.error.detail) || ('Paddle API ' + res.status);
    throw new Error('createCheckout failed: ' + msg);
  }

  const txn = json.data || {};
  // Paddle returns a transaction id (txn_...) used by Paddle.js to open checkout.
  // Some configurations also return a hosted checkout URL under checkout.url.
  return {
    transactionId: txn.id,
    url: (txn.checkout && txn.checkout.url) || null
  };
}

/**
 * Verify the Paddle-Signature header.
 * Header format: "ts=<unix>;h1=<hmac_sha256_hex>"
 * Signed payload = "<ts>:<rawBody>", key = PADDLE_WEBHOOK_SECRET.
 */
function verifyWebhook(rawBody, headers) {
  const secret = config.paddle.webhookSecret;
  if (!secret) return false;

  const sigHeader = headers['paddle-signature'] || headers['Paddle-Signature'];
  if (!sigHeader) return false;

  // Parse "ts=...;h1=..."
  const parts = {};
  String(sigHeader).split(';').forEach(function(kv) {
    const idx = kv.indexOf('=');
    if (idx > -1) parts[kv.slice(0, idx).trim()] = kv.slice(idx + 1).trim();
  });
  const ts = parts.ts;
  const h1 = parts.h1;
  if (!ts || !h1) return false;

  const raw = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const signedPayload = ts + ':' + raw;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  // Constant-time compare.
  try {
    const a = Buffer.from(h1, 'hex');
    const b = Buffer.from(expected, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
}

// Map Paddle plan/price back to our plan_type is done via custom_data.plan_type.
function statusFromPaddleSub(paddleStatus) {
  switch (paddleStatus) {
    case 'active':   return 'active';
    case 'trialing': return 'active';
    case 'past_due': return 'past_due';
    case 'paused':   return 'canceled';
    case 'canceled': return 'canceled';
    default:         return 'active';
  }
}

/**
 * Parse a Paddle webhook body into a MappedEvent.
 */
function parseEvent(rawBody, headers) {
  const raw = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const evt = JSON.parse(raw);
  const eventName = evt.event_type || evt.eventName || 'unknown';
  const data = evt.data || {};
  const custom = data.custom_data || {};

  const mapped = {
    providerEventId: evt.event_id || evt.notification_id || (eventName + ':' + (data.id || '')),
    provider: 'paddle',
    eventName: eventName,
    action: 'none',
    userId: custom.user_id,
    courseId: custom.course_id,
    planType: custom.plan_type,
    providerCustomerId: data.customer_id,
    providerSubscriptionId: data.subscription_id || (data.id && String(data.id).startsWith('sub_') ? data.id : undefined),
    providerPriceId: undefined,
    status: undefined,
    currentPeriodEnd: undefined
  };

  // Try to extract price id from items.
  if (Array.isArray(data.items) && data.items.length) {
    const item = data.items[0];
    mapped.providerPriceId = (item.price && item.price.id) || item.price_id;
  }

  switch (eventName) {
    // One-time purchase (lifetime) completes as a transaction.
    case 'transaction.completed':
      mapped.action = 'grant';
      mapped.status = 'active';
      // lifetime => no period end
      if (!mapped.planType) mapped.planType = 'lifetime';
      mapped.providerSubscriptionId = mapped.providerSubscriptionId || null;
      mapped.currentPeriodEnd = null;
      break;

    case 'subscription.created':
    case 'subscription.activated':
      mapped.action = 'grant';
      mapped.status = 'active';
      mapped.providerSubscriptionId = data.id;
      mapped.currentPeriodEnd = data.current_billing_period && data.current_billing_period.ends_at;
      break;

    case 'subscription.updated':
      mapped.action = 'update';
      mapped.status = statusFromPaddleSub(data.status);
      mapped.providerSubscriptionId = data.id;
      mapped.currentPeriodEnd = data.current_billing_period && data.current_billing_period.ends_at;
      break;

    case 'subscription.canceled':
    case 'subscription.paused':
      mapped.action = 'revoke';
      mapped.status = 'canceled';
      mapped.providerSubscriptionId = data.id;
      mapped.currentPeriodEnd = data.current_billing_period && data.current_billing_period.ends_at;
      break;

    case 'transaction.payment_failed':
      mapped.action = 'update';
      mapped.status = 'past_due';
      break;

    case 'adjustment.created': // refunds appear as adjustments
      if (data.action === 'refund') {
        mapped.action = 'revoke';
        mapped.status = 'refunded';
        mapped.providerSubscriptionId = data.subscription_id;
      }
      break;

    default:
      mapped.action = 'none';
  }

  return mapped;
}

/**
 * Create a customer portal session URL for managing/canceling subscriptions.
 */
async function getPortalUrl(args) {
  if (!config.paddle.apiKey) throw new Error('Paddle not configured.');
  if (!args.providerCustomerId) throw new Error('Missing providerCustomerId.');

  const res = await fetch(API_BASE + '/customers/' + args.providerCustomerId + '/portal-sessions', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({})
  });
  const json = await res.json();
  if (!res.ok) {
    const msg = (json && json.error && json.error.detail) || ('Paddle API ' + res.status);
    throw new Error('getPortalUrl failed: ' + msg);
  }
  const urls = json.data && json.data.urls && json.data.urls.general;
  return { url: (urls && urls.overview) || null };
}

module.exports = {
  name: 'paddle',
  createCheckout: createCheckout,
  verifyWebhook: verifyWebhook,
  parseEvent: parseEvent,
  getPortalUrl: getPortalUrl
};
