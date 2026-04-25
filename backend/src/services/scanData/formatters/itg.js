/**
 * itg.js — ITG Brands Retailer Incentive feed formatter (Session 47).
 *
 * Single-feed, pipe-delimited. Most forgiving cert spec — line-level errors
 * don't reject the batch (good first cert target).
 *
 * Field structure follows the typical NACS scan-data layout. Exact positions
 * will be tweaked during cert with ITG; the format function below is the
 * canonical starting point.
 *
 * File layout:
 *   Header:  H|<retailerId>|<chainId>|<storeId>|<periodStart>|<periodEnd>|<generatedAt>
 *   Detail:  D|<txId>|<txDate>|<txTime>|<register>|<cashier>|<saleType>|<upc>|<productCode>|<brand>|<qty>|<retailPrice>|<grossLine>|<netLine>|<buydown>|<multipack>|<mfrCoupon>|<couponSerial>|<retailerCoupon>|<loyalty>|<ageVerified>
 *   Trailer: T|<txCount>|<lineCount>|<grossTotal>|<netTotal>|<couponCount>|<couponTotal>
 *
 * One D record per qualifying line item. Voids and refunds are tagged via saleType.
 */

import {
  pipeEscape, fmtDate, fmtTime, txMeta,
  extractTobaccoLines, buildTotals,
} from './common.js';

const FORMAT_VERSION = '1.0';

export function format({ enrollment, transactions, productMapByUpc, periodStart, periodEnd }) {
  const lines = [];
  const records = []; // collected for trailer totals

  // Header — pipe-delimited
  lines.push([
    'H',
    pipeEscape(enrollment.mfrRetailerId || ''),
    pipeEscape(enrollment.mfrChainId || ''),
    pipeEscape(enrollment.storeId || ''),
    fmtDate(periodStart, '-'),
    fmtDate(periodEnd, '-'),
    `${fmtDate(new Date(), '-')}T${fmtTime(new Date(), ':')}`,
    `ITG-${FORMAT_VERSION}`,
  ].join('|'));

  // Detail records — one per qualifying tobacco line per tx
  for (const tx of transactions) {
    const meta  = txMeta(tx);
    const itgLines = extractTobaccoLines(tx, productMapByUpc, 'itg');
    for (const li of itgLines) {
      records.push({ tx: meta, line: li });
      lines.push([
        'D',
        pipeEscape(meta.txNumber),
        fmtDate(meta.createdAt, '-'),
        fmtTime(meta.createdAt, ':'),
        pipeEscape(meta.stationId),
        pipeEscape(meta.cashierId),
        meta.saleType,                      // S | V | R
        li.upc,
        pipeEscape(li.productCode),
        pipeEscape(li.brandFamily),
        li.qty,
        li.retailPrice.toFixed(2),
        li.grossLine.toFixed(2),
        li.netLine.toFixed(2),
        li.buydownAmount.toFixed(2),
        li.multipackAmount.toFixed(2),
        li.mfrCouponAmount.toFixed(2),
        pipeEscape(li.mfrCouponSerial),
        li.retailerCouponAmount.toFixed(2),
        li.loyaltyAmount.toFixed(2),
        meta.ageVerified,
      ].join('|'));
    }
  }

  // Trailer
  const totals = buildTotals(records);
  lines.push([
    'T',
    totals.txCount,
    totals.lineCount,
    totals.grossTotal.toFixed(2),
    totals.netTotal.toFixed(2),
    totals.couponCount,
    totals.couponTotal.toFixed(2),
  ].join('|'));

  return {
    body:    lines.join('\n') + '\n',
    txCount:     totals.txCount,
    lineCount:   totals.lineCount,
    couponCount: totals.couponCount,
    totalAmount: totals.netTotal,
  };
}
