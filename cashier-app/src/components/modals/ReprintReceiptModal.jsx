/**
 * ReprintReceiptModal
 * Shows a past transaction on-screen.
 * onPrint(tx) -> sends directly to thermal printer via hardware (no browser dialog).
 */
import React from 'react';
import { X, Printer } from 'lucide-react';
import { fmt$, fmtTxNumber } from '../../utils/formatters.js';
import { useAuthStore } from '../../stores/useAuthStore.js';
import './ReprintReceiptModal.css';

export default function ReprintReceiptModal({ tx, onClose, onPrint }) {
  const cashier     = useAuthStore(s => s.cashier);
  const cashierName = tx?.cashierName || cashier?.name || cashier?.email || '';

  if (!tx) return null;

  const handlePrint = () => {
    if (onPrint) onPrint(tx);
  };

  return (
    <div className="rrm-backdrop">
      <div className="rrm-modal">

        {/* Header */}
        <div className="rrm-header">
          <div>
            <div className="rrm-header-title">Receipt</div>
            <div className="rrm-header-sub">
              {fmtTxNumber(tx.txNumber)} - {new Date(tx.createdAt).toLocaleString()}
            </div>
          </div>
          <button className="rrm-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Receipt body */}
        <div className="rrm-body">

          {/* Line items */}
          <div className="rrm-items">
            {(tx.lineItems || []).map((item, i) => (
              <div key={i} className="rrm-item">
                <div className="rrm-item-row">
                  <span className="rrm-item-name">
                    {item.qty > 1 ? `${item.qty}x ` : ''}{item.name}
                  </span>
                  <span className="rrm-item-total">{fmt$(item.lineTotal)}</span>
                </div>
                {item.depositTotal > 0 && (
                  <div className="rrm-item-deposit">
                    <span>Deposit</span>
                    <span>{fmt$(item.depositTotal)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="rrm-total-row">
            <span className="rrm-total-label">TOTAL</span>
            <span className="rrm-total-value">{fmt$(Math.abs(tx.grandTotal))}</span>
          </div>

          {/* Tender lines */}
          <div className="rrm-tenders">
            {(tx.tenderLines || []).map((t, i) => (
              <div key={i} className="rrm-tender-row">
                <span>{t.method.replace('_', ' ').toUpperCase()}</span>
                <span>{fmt$(t.amount)}</span>
              </div>
            ))}
            {tx.changeGiven > 0 && (
              <div className="rrm-change-row">
                <span>CHANGE</span>
                <span>{fmt$(tx.changeGiven)}</span>
              </div>
            )}
          </div>

          {/* Cashier footer */}
          <div className="rrm-cashier-footer">
            Cashier: {cashierName}<br />
            Thank you for shopping with us!
          </div>
        </div>

        {/* Actions */}
        <div className="rrm-actions">
          <button className="rrm-btn-print" onClick={handlePrint}>
            <Printer size={15} /> Print Receipt
          </button>
          <button className="rrm-btn-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
