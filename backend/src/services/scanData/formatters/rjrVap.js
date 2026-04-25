/**
 * rjrVap.js — RJR Valued Adult Program (smokeless / pouch) feed.
 *
 * Same fixed-width body as EDLP but flagged 'VAP'. Brand families are
 * Grizzly + Camel Snus only.
 */

import { formatRJR } from './rjrEdlp.js';

export function format(args) {
  return formatRJR({ ...args, feedCode: 'VAP' });
}
