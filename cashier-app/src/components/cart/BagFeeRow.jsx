/**
 * BagFeeRow — compact bag counter that sits above payment buttons.
 * [ Bags  (−) 0 (+)  $0.00 ]
 */

import React from 'react';
import { ShoppingBag, Minus, Plus } from 'lucide-react';
import { fmt$ } from '../../utils/formatters.js';
import './BagFeeRow.css';

export default function BagFeeRow({ bagCount, onIncrement, onDecrement, bagPrice, bagTotal }) {
  return (
    <div className="bfr-row">
      {/* Label */}
      <div className="bfr-label">
        <ShoppingBag size={14} color="var(--text-muted)" />
        <span className="bfr-label-text">Bags</span>
        <span className="bfr-label-price">({fmt$(bagPrice)} ea)</span>
      </div>

      {/* Controls */}
      <div className="bfr-controls">
        <button
          onClick={onDecrement}
          disabled={bagCount <= 0}
          className={`bfr-btn bfr-btn-dec ${bagCount > 0 ? 'bfr-btn-dec--active' : ''}`}
        >
          <Minus size={13} />
        </button>

        <span className={`bfr-count ${bagCount > 0 ? 'bfr-count--active' : 'bfr-count--zero'}`}>
          {bagCount}
        </span>

        <button onClick={onIncrement} className="bfr-btn bfr-btn-inc">
          <Plus size={13} />
        </button>

        {/* Total */}
        <span className={`bfr-total ${bagTotal > 0 ? 'bfr-total--active' : 'bfr-total--zero'}`}>
          {fmt$(bagTotal)}
        </span>
      </div>
    </div>
  );
}
