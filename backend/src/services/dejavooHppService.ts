/**
 * dejavooHppService.ts — backward-compat shim.
 *
 * The implementation lives in `./dejavoo/hpp/` (split into 5 focused
 * modules: types, api-spec, client, checkout, webhook).
 *
 * This file exists so existing imports keep working without changes:
 *   import { createCheckoutSession } from '../services/dejavooHppService.js';
 *
 * New code should prefer importing directly from the sub-module that has
 * what it needs (e.g. `./dejavoo/hpp/checkout.js`) for clearer dependency
 * hints.
 */

export * from './dejavoo/hpp/index.js';
