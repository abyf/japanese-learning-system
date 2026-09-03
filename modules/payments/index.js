/**
 * Payment adapter selector (Task 7.2)
 *
 * Returns the active PaymentAdapter based on config.paymentProvider. Adding a
 * new provider = drop a new implementation here and add a case. Nothing else in
 * the platform changes (provider neutrality).
 */

'use strict';

const config = require('../../config.platform');

let cached = null;

function getAdapter() {
  if (cached) return cached;
  switch (config.paymentProvider) {
    case 'paddle':
      cached = require('./paddle');
      break;
    // Future:
    // case 'lemonsqueezy': cached = require('./lemonsqueezy'); break;
    // case 'stripe':       cached = require('./stripe'); break;
    default:
      throw new Error('Unknown PAYMENT_PROVIDER: ' + config.paymentProvider);
  }
  return cached;
}

module.exports = { getAdapter };
