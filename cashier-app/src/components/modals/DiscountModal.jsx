/**
 * DiscountModal — Apply % or $ discount.
 * Side-by-side layout: left = context/preview, right = numpad.
 */

import React, { useState } from 'react';
import { X, Tag, Trash2 } from 'lucide-react';
import { useCartStore } from '../../stores/useCartStore.js';
import { fmt$ } from '../../utils/formatters.js';
import NumPadInline, { digitsToNumber } from '../pos/NumPadInline.jsx';
import './DiscountModal.css';

export default function DiscountModal({ lineId, onClose }) {
  const items          = useCartStore(s => s.items);
  const applyLineDisc  = useCartStore(s => s.applyLineDiscount);
  const applyOrderDisc = useCartStore(s => s.applyOrderDiscount);
  const removeLineDisc = useCartStore(s => s.removeLineDiscount);
  const removeOrderDisc= useCartStore(s => s.removeOrderDiscount);
  const orderDiscount  = useCartStore(s => s.orderDiscount);

  const item     = lineId ? items.find(i => i.lineId === lineId) : null;
  const existing = lineId
    ? (item?.discountType ? { type: item.discountType, value: item.discountValue } : null)
    : orderDiscount;

  const [discType, setDiscType] = useState(existing?.type || 'percent');
  const [digits,   setDigits]   = useState(() => {
    if (existing?.value == null) return '';
    if (existing.type === 'percent') return String(Math.round(existing.value));
    return String(Math.round(existing.value * 100));
  });
  const [error, setError] = useState('');

  const decimals = discType === 'percent' ? 0 : 2;
  const numVal   = digitsToNumber(digits, decimals);

  const preview = (() => {
    if (!numVal) return null;
    if (item) {
      const eff = discType === 'percent'
        ? item.unitPrice * (1 - numVal / 100)
        : Math.max(0, item.unitPrice - numVal);
      return { original: item.unitPrice * item.qty, discounted: eff * item.qty };
    }
    const sub  = items.reduce((s, i) => s + i.lineTotal, 0);
    const disc = discType === 'percent' ? sub * numVal / 100 : Math.min(numVal, sub);
    return { original: sub, discounted: sub - disc };
  })();

  const label = item ? `Discount: ${item.name}` : 'Order Discount';

  const apply = () => {
    if (!numVal || numVal <= 0)               { setError('Enter a valid discount amount'); return; }
    if (discType === 'percent' && numVal > 100){ setError('Maximum 100%'); return; }
    if (lineId) applyLineDisc(lineId, discType, numVal);
    else        applyOrderDisc(discType, numVal);
    onClose();
  };

  const remove = () => {
    if (lineId) removeLineDisc(lineId);
    else        removeOrderDisc();
    onClose();
  };

  const handleTypeChange = (t) => { setDiscType(t); setDigits(''); setError(''); };
  const handleChange = (v) => { setDigits(v); setError(''); };

  return (
    <div className="dm-backdrop">
      <div className="dm-modal">
        {/* Header */}
        <div className="dm-header">
          <div className="dm-header-icon">
            <Tag size={16} color="var(--amber)" />
          </div>
          <div className="dm-header-content">
            <div className="dm-header-sup">APPLY DISCOUNT</div>
            <div className="dm-header-title">{label}</div>
          </div>
          <button className="dm-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="dm-body">

          {/* Left */}
          <div className="dm-left">
            <div className="dm-type-row">
              {[
                { id: 'percent', label: '% Percent Off', cls: 'dm-type-btn--active-pct' },
                { id: 'amount',  label: '$ Dollar Off',  cls: 'dm-type-btn--active-amt' },
              ].map(t => (
                <button
                  key={t.id}
                  className={`dm-type-btn${discType === t.id ? ` ${t.cls}` : ''}`}
                  onClick={() => handleTypeChange(t.id)}
                >{t.label}</button>
              ))}
            </div>

            {discType === 'percent' && (
              <div className="dm-presets">
                {[5, 10, 15, 20, 25, 50].map(p => (
                  <button
                    key={p}
                    className={`dm-preset-btn${numVal === p ? ' dm-preset-btn--active' : ''}`}
                    onClick={() => { setDigits(String(p)); setError(''); }}
                  >{p}%</button>
                ))}
              </div>
            )}

            {error && <div className="dm-error">{error}</div>}

            {preview ? (
              <div className="dm-preview">
                <div className="dm-preview-label">PREVIEW</div>
                <div className="dm-preview-row">
                  <div>
                    <div className="dm-preview-sub-label">Original</div>
                    <div className="dm-preview-original">{fmt$(preview.original)}</div>
                  </div>
                  <div className="dm-preview-arrow">&rarr;</div>
                  <div className="dm-preview-after-wrap">
                    <div className="dm-preview-sub-label">After discount</div>
                    <div className="dm-preview-after">{fmt$(Math.max(0, preview.discounted))}</div>
                  </div>
                </div>
                <div className="dm-preview-saving">
                  Saving {discType === 'percent' ? `${numVal}%` : fmt$(numVal)}
                  {discType === 'percent' && preview && ` — ${fmt$(preview.original - Math.max(0, preview.discounted))}`}
                </div>
              </div>
            ) : (
              <div className="dm-preview-empty">
                <Tag size={32} />
              </div>
            )}
          </div>

          {/* Right */}
          <div className="dm-right">
            <NumPadInline
              value={digits}
              onChange={handleChange}
              accentColor={discType === 'percent' ? 'var(--amber)' : 'var(--green)'}
              prefix={discType === 'percent' ? '%' : '$'}
              decimals={decimals}
              maxDigits={discType === 'percent' ? 3 : 7}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="dm-footer">
          {existing && (
            <button className="dm-btn-remove" onClick={remove}>
              <Trash2 size={15} /> Remove
            </button>
          )}
          <button
            className={`dm-btn-apply${numVal > 0 ? ' dm-btn-apply--active' : ' dm-btn-apply--disabled'}`}
            onClick={apply}
            disabled={!numVal || numVal <= 0}
          >
            <Tag size={16} /> Apply Discount
          </button>
        </div>
      </div>
    </div>
  );
}
