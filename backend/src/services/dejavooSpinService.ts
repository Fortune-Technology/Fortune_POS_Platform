/**
 * dejavooSpinService.ts — backward-compat shim.
 *
 * The implementation lives in `./dejavoo/spin/` (split into 6 focused
 * modules: types, client, payload, transactions, terminal, constants).
 *
 * This file exists so existing imports keep working without changes:
 *   import { sale, refund } from '../services/dejavooSpinService.js';
 *
 * New code should prefer importing directly from the sub-module that has
 * what it needs (e.g. `./dejavoo/spin/transactions.js`) for clearer
 * dependency hints.
 */

export * from './dejavoo/spin/index.js';
