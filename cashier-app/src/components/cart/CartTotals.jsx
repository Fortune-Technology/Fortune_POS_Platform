import React from 'react';
import { fmt$ } from '../../utils/formatters.js';
import './CartTotals.css';

export default function CartTotals({ totals, itemCount, bagCount = 0 }) {
  const { subtotal, discountAmount, ebtTotal, depositTotal, taxTotal, grandTotal, bagTotal } = totals;

  return (
    <div className="ct-wrap">
      <Row label={`Subtotal (${itemCount} item${itemCount !== 1 ? 's' : ''})`} value={fmt$(subtotal)} />

      {discountAmount > 0 && (
        <Row
          label="Discount"
          value={`-${fmt$(discountAmount)}`}
          valueClass="ct-row-value--amber"
          labelClass="ct-row-label--amber"
        />
      )}

      {totals.promoSaving > 0 && (
        <Row
          label="Promo Savings"
          value={`-${fmt$(totals.promoSaving)}`}
          valueClass="ct-row-value--green"
          labelClass="ct-row-label--green"
          note="Auto-applied"
        />
      )}

      {ebtTotal > 0 && (
        <Row
          label="EBT Eligible"
          value={fmt$(ebtTotal)}
          valueClass="ct-row-value--green2"
          labelClass="ct-row-label--green2"
        />
      )}

      {depositTotal > 0 && (
        <Row
          label="Bottle Deposits"
          value={fmt$(depositTotal)}
          valueClass="ct-row-value--deposit"
          note="No Tax"
        />
      )}

      {bagTotal > 0 && (
        <Row
          label={`Bags (${bagCount})`}
          value={fmt$(bagTotal)}
          note="No Tax"
        />
      )}

      {taxTotal > 0 && <Row label="Tax" value={fmt$(taxTotal)} />}

      {/* Grand total */}
      <div className="ct-grand">
        <span className="ct-grand-label">TOTAL</span>
        <span className="ct-grand-value">{fmt$(grandTotal)}</span>
      </div>
    </div>
  );
}

function Row({ label, value, valueClass, labelClass, note }) {
  return (
    <div className="ct-row">
      <span className={`ct-row-label ${labelClass || ''}`}>
        {label}
        {note && <span className="ct-row-note">({note})</span>}
      </span>
      <span className={`ct-row-value ${valueClass || ''}`}>
        {value}
      </span>
    </div>
  );
}
