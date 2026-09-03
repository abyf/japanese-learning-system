/**
 * Payment Adapter Interface (Task 7.2)
 *
 * Provider-neutral contract for payment providers. Each provider (Paddle first,
 * later possibly Lemon Squeezy / Stripe) implements this interface. The rest of
 * the platform (entitlements, access control, routes) never imports a provider
 * directly — it goes through the adapter selected by PAYMENT_PROVIDER.
 *
 * This file documents the shape via JSDoc typedefs. Implementations live beside
 * it (e.g., paddle.js) and index.js selects one.
 */

'use strict';

/**
 * A provider event normalized into a provider-neutral shape.
 * @typedef {Object} MappedEvent
 * @property {string}  providerEventId          - unique event id (idempotency key)
 * @property {string}  provider                 - e.g. 'paddle'
 * @property {string}  eventName                - raw provider event name
 * @property {'grant'|'update'|'revoke'|'none'} action - what to do with entitlement
 * @property {string=} userId                   - resolved app user id (from custom data)
 * @property {string=} courseId                 - resolved course id (from custom data)
 * @property {boolean=} allAccess               - true for an all-courses entitlement
 * @property {('monthly'|'annual'|'lifetime')=} planType
 * @property {string=} providerCustomerId
 * @property {string=} providerSubscriptionId
 * @property {string=} providerPriceId
 * @property {('active'|'canceled'|'expired'|'refunded'|'past_due')=} status
 * @property {string=} currentPeriodEnd         - ISO date; null/undefined = lifetime
 */

/**
 * @typedef {Object} PaymentAdapter
 * @property {string} name
 * @property {(args: {userId: string, email?: string, courseId: string, planType: string, providerPriceId: string, successUrl: string}) => Promise<{url?: string, checkout?: object}>} createCheckout
 * @property {(rawBody: Buffer|string, headers: object) => boolean} verifyWebhook
 * @property {(rawBody: Buffer|string, headers: object) => MappedEvent} parseEvent
 * @property {(args: {providerCustomerId: string}) => Promise<{url: string}>} getPortalUrl
 */

// This module only exports documentation/typedefs; implementations are separate.
module.exports = {};
