/**
 * Dejavoo HPP — public API barrel.
 *
 * Re-exports every public symbol from the sub-modules so callers can do:
 *   import { createCheckoutSession } from 'services/dejavoo/hpp/index.js'
 *   import { createCheckoutSession } from 'services/dejavooHppService.js'  ← legacy shim
 *
 * Both paths work. New code should prefer importing directly from the
 * sub-module that has what it needs (`./hpp/checkout.js`, `./hpp/webhook.js`)
 * for clearer dependency hints.
 */

// Types
export type {
  DejavooHppMerchant,
  CreateCheckoutOpts,
  CreateCheckoutResult,
} from './types.js';

// API constants
export { HPP_API_SPEC } from './api-spec.js';

// Client helpers
export {
  buildAuthHeaderValue,
  generateReferenceId,
} from './client.js';

// Checkout
export { createCheckoutSession, queryPaymentStatus } from './checkout.js';

// Webhook + response parsing
export {
  verifyWebhookAuthHeader,
  parseHppResponse,
  mapStatus,
  buildNotifyUrl,
} from './webhook.js';
