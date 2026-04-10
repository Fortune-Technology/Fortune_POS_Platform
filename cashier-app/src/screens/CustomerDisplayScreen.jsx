/**
 * CustomerDisplayScreen — read-only, customer-facing second screen.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useCustomerDisplaySubscriber } from '../hooks/useBroadcastSync.js';
import './CustomerDisplayScreen.css';

const fmt$ = (n) => {
  const v = Number(n) || 0;
  return v < 0 ? `-$${Math.abs(v).toFixed(2)}` : `$${v.toFixed(2)}`;
};

export default function CustomerDisplayScreen() {
  const [state, setState] = useState({
    type: 'idle', items: [], totals: {}, bagCount: 0, bagPrice: 0,
    customer: null, loyaltyRedemption: null, orderDiscount: null,
    promoResults: { totalSaving: 0, appliedPromos: [] }, storeName: '',
  });

  const [thankYou, setThankYou] = useState(null);
  const thankYouTimer = useRef(null);

  const handleMessage = useCallback((data) => {
    if (!data?.type) return;
    if (data.type === 'cart_update') {
      setState(data);
      setThankYou(null);
    } else if (data.type === 'transaction_complete') {
      setThankYou({ change: data.change, txNumber: data.txNumber });
      clearTimeout(thankYouTimer.current);
      thankYouTimer.current = setTimeout(() => {
        setThankYou(null);
        setState(s => ({ ...s, type: 'idle', items: [], totals: {}, bagCount: 0, customer: null, loyaltyRedemption: null }));
      }, 6000);
    } else if (data.type === 'idle') {
      setState(s => ({ ...s, type: 'idle', items: [], totals: {}, bagCount: 0, customer: null, loyaltyRedemption: null }));
      setThankYou(null);
    }
  }, []);

  useCustomerDisplaySubscriber(handleMessage);

  const listRef = useRef(null);
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [state.items?.length]);

  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { items = [], totals = {}, customer, loyaltyRedemption, bagCount = 0, bagPrice = 0, promoResults, storeName } = state;
  const hasItems = items.length > 0;
  const itemCount = items.reduce((s, i) => s + (i.qty || 1), 0);

  // ── Thank You ──
  if (thankYou) {
    return (
      <div className="cds-root">
        <div className="cds-page">
          <div className="cds-thankyou-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#7ac143" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="cds-thankyou-title">Thank You!</div>
          {thankYou.change > 0 && (
            <div className="cds-thankyou-change">
              Change Due: <span className="cds-thankyou-change-amt">{fmt$(thankYou.change)}</span>
            </div>
          )}
          <div className="cds-thankyou-bye">Have a great day!</div>
        </div>
      </div>
    );
  }

  // ── Idle ──
  if (!hasItems) {
    return (
      <div className="cds-root">
        <div className="cds-page">
          <div className="cds-idle-store">{storeName || 'Welcome'}</div>
          <div className="cds-idle-clock">
            {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    );
  }

  // ── Active Cart ──
  return (
    <div className="cds-root">
      <div className="cds-active">
        {/* Header */}
        <div className="cds-header">
          <span className="cds-header-store">{storeName || 'StoreVue POS'}</span>
          <span className="cds-header-clock">
            {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Customer bar */}
        {customer && (
          <div className="cds-customer-bar">
            <div className="cds-customer-info">
              <div className="cds-customer-avatar">
                {(customer.name || '?')[0]?.toUpperCase()}
              </div>
              <div>
                <div className="cds-customer-name">{customer.name}</div>
                {customer.phone && <div className="cds-customer-phone">{customer.phone}</div>}
              </div>
            </div>
            {customer.loyaltyPoints != null && (
              <div className="cds-customer-points">
                {customer.loyaltyPoints.toLocaleString()} pts
              </div>
            )}
          </div>
        )}

        {/* Line items */}
        <div ref={listRef} className="cds-items">
          {items.map((item, idx) => (
            <div key={item.lineId || idx} className="cds-line-item">
              <div className="cds-line-left">
                <div className="cds-line-name">
                  {item.isBagFee ? '\uD83D\uDECD\uFE0F ' : ''}{item.name}
                </div>
                <div className="cds-line-qty">
                  {item.qty > 1 && <span>{item.qty} x {fmt$(item.unitPrice)}</span>}
                </div>
                {item.promoAdjustment && (
                  <div className="cds-line-promo">
                    Promo: -{item.promoAdjustment.discountType === 'percent'
                      ? `${item.promoAdjustment.discountValue}%`
                      : fmt$(item.promoAdjustment.discountValue)}
                  </div>
                )}
                {item.discountType && (
                  <div className="cds-line-discount">
                    Discount: -{item.discountType === 'percent'
                      ? `${item.discountValue}%`
                      : fmt$(item.discountValue)}
                  </div>
                )}
                {item.depositTotal > 0 && (
                  <div className="cds-line-deposit">+ Deposit {fmt$(item.depositTotal)}</div>
                )}
              </div>
              <div className={`cds-line-total ${item.lineTotal < 0 ? 'cds-line-total--negative' : 'cds-line-total--positive'}`}>
                {fmt$(item.lineTotal)}
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="cds-summary">
          <SummaryRow label={`Subtotal (${itemCount} item${itemCount !== 1 ? 's' : ''})`} value={fmt$(totals.subtotal)} />
          {totals.discountAmount > 0 && <SummaryRow label="Discount" value={`-${fmt$(totals.discountAmount)}`} color="#f59e0b" />}
          {totals.promoSaving > 0 && <SummaryRow label="Promo Savings" value={`-${fmt$(totals.promoSaving)}`} color="#7ac143" />}
          {loyaltyRedemption && (
            <SummaryRow
              label={`Points Redeemed (${loyaltyRedemption.pointsCost} pts)`}
              value={loyaltyRedemption.discountType === 'dollar_off' ? `-${fmt$(loyaltyRedemption.discountValue)}` : `-${loyaltyRedemption.discountValue}%`}
              color="#7ac143"
            />
          )}
          {totals.depositTotal > 0 && <SummaryRow label="Bottle Deposits" value={fmt$(totals.depositTotal)} muted />}
          {totals.bagTotal > 0 && <SummaryRow label={`Bag Fee (${bagCount})`} value={fmt$(totals.bagTotal)} muted />}
          {totals.taxTotal > 0 && <SummaryRow label="Tax" value={fmt$(totals.taxTotal)} />}
          {totals.ebtTotal > 0 && <SummaryRow label="EBT Eligible" value={fmt$(totals.ebtTotal)} color="#7ac143" />}

          <div className="cds-grand">
            <span className="cds-grand-label">TOTAL</span>
            <span className="cds-grand-value">{fmt$(totals.grandTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, color, muted }) {
  const labelClass = color
    ? 'cds-summary-label cds-summary-label--colored'
    : muted
      ? 'cds-summary-label cds-summary-label--muted'
      : 'cds-summary-label';

  return (
    <div className="cds-summary-row">
      <span className={labelClass} style={color ? { color } : undefined}>{label}</span>
      <span className="cds-summary-value" style={color ? { color } : undefined}>{value}</span>
    </div>
  );
}
