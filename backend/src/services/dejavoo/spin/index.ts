/**
 * Dejavoo SPIn — public API barrel.
 *
 * This file re-exports every public symbol from the sub-modules so callers
 * can do either:
 *   import { sale, refund } from 'services/dejavoo/spin/index.js'
 *   import { sale, refund } from 'services/dejavooSpinService.js'   ← legacy shim
 *
 * Both paths work — pick whichever feels right. New code should prefer the
 * direct sub-module path (`./spin/transactions.js` etc.) when it only needs
 * one slice of functionality, since that gives clearer dependency hints.
 */

// Types
export type { DejavooSpinMerchant, SpinOpts } from './types.js';

// Client + helpers
export { generateReferenceId } from './client.js';

// Transaction methods
export { sale, refund, voidTransaction, tipAdjust, balance, getCard } from './transactions.js';

// Terminal control + probes
export { abort, settle, status, userInput, terminalStatus } from './terminal.js';

// Lookup tables
export { PAYMENT_TYPE_MAP, STATUS_MESSAGES } from './constants.js';
