import React from 'react';
import { CheckCircle, Printer, RefreshCw } from 'lucide-react';
import { fmt$, fmtDate, fmtTime, fmtTxNumber } from '../../utils/formatters.js';
import { useAuthStore } from '../../stores/useAuthStore.js';
import './ReceiptModal.css';

export default function ReceiptModal({ tx, totals, change, onDone }) {
  const cashier = useAuthStore(s => s.cashier);
  const print = () => window.print();

  return (
    <div className="modal-backdrop">
      <div className="modal-box rm-card">
        {/* Success header */}
        <div className="rm-header">
          <div className="rm-icon">
            <CheckCircle size={28} color="var(--green)" />
          </div>
          <div className="rm-title">Sale Complete</div>
          <div className="rm-subtitle">
            {fmtTxNumber(tx.txNumber)} &middot; {fmtDate()} {fmtTime()}
          </div>
        </div>

        {/* Receipt body */}
        <div className="rm-body receipt-print">
          {/* Line items */}
          <div className="rm-items">
            {tx.lineItems?.map((item, i) => (
              <div key={i} className="rm-item">
                <div className="rm-item-row">
                  <span className="rm-item-name">
                    {item.qty > 1 ? `${item.qty}\u00D7 ` : ''}{item.name}
                  </span>
                  <span className="rm-item-total">{fmt$(item.lineTotal)}</span>
                </div>
                {item.depositTotal > 0 && (
                  <div className="rm-item-deposit">
                    <span>  \u2514 Deposit</span>
                    <span>{fmt$(item.depositTotal)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Totals */}
          {[
            ['Subtotal',        fmt$(totals.subtotal)],
            totals.ebtTotal > 0 ? ['EBT Applied', fmt$(totals.ebtTotal)] : null,
            totals.depositTotal > 0 ? ['Deposits', fmt$(totals.depositTotal)] : null,
            totals.taxTotal > 0 ? ['Tax', fmt$(totals.taxTotal)] : null,
          ].filter(Boolean).map(([label, val]) => (
            <div key={label} className="rm-summary-row">
              <span>{label}</span><span>{val}</span>
            </div>
          ))}
          <div className="rm-total-row">
            <span>TOTAL</span><span className="rm-total-value">{fmt$(totals.grandTotal)}</span>
          </div>

          {/* Tender */}
          <div className="rm-tender">
            {tx.tenderLines?.map((t, i) => (
              <div key={i} className="rm-tender-row">
                <span>{t.method.toUpperCase()}</span>
                <span>{fmt$(t.amount)}</span>
              </div>
            ))}
            {change > 0 && (
              <div className="rm-change-row">
                <span>CHANGE</span><span>{fmt$(change)}</span>
              </div>
            )}
          </div>

          {/* Cashier */}
          <div className="rm-footer">
            Cashier: {cashier?.name || cashier?.email}<br />
            Thank you for shopping with us!
          </div>
        </div>

        {/* Actions */}
        <div className="rm-actions">
          <button onClick={print} className="rm-print-btn">
            <Printer size={15} /> Print
          </button>
          <button onClick={onDone} className="rm-done-btn">
            <RefreshCw size={15} /> New Sale
          </button>
        </div>
      </div>
    </div>
  );
}
