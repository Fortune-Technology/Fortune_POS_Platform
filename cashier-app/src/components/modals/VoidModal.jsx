/**
 * VoidModal — Confirms voiding the current (un-tendered) transaction.
 * Shows the items currently rung up, asks for an optional reason, then clears the cart.
 */
import React, { useState } from 'react';
import { X, Ban, AlertTriangle, Check } from 'lucide-react';
import { fmt$ } from '../../utils/formatters.js';
import './VoidModal.css';

export default function VoidModal({ onClose, items = [], totals = {}, onConfirm }) {
  const [note, setNote]   = useState('');
  const [done, setDone]   = useState(false);

  const doVoid = () => {
    setDone(true);
    setTimeout(() => {
      onConfirm?.(note);
      onClose();
    }, 800);
  };

  const grandTotal = totals.grandTotal ?? 0;

  return (
    <div className="vm-backdrop">
      <div className="vm-modal">

        {/* Header */}
        <div className="vm-header">
          <div className="vm-header-left">
            <Ban size={16} color="var(--red)" />
            <span className="vm-header-title">Void Current Transaction</span>
          </div>
          <button className="vm-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {done ? (
          <div className="vm-success">
            <div className="vm-success-icon">
              <Check size={24} color="var(--red)" />
            </div>
            <div className="vm-success-text">Transaction Voided</div>
          </div>
        ) : (
          <div className="vm-body">

            {/* Current cart items */}
            <div className="vm-items-box">
              <div className="vm-items-scroll">
                {items.length === 0 ? (
                  <div className="vm-empty">No items in cart</div>
                ) : items.map((item, i) => (
                  <div key={item.lineId} className="vm-item-row">
                    <span className="vm-item-name">
                      {item.qty > 1 ? `${item.qty}x ` : ''}{item.name}
                    </span>
                    <span className="vm-item-total">
                      {fmt$(item.lineTotal ?? item.unitPrice * item.qty)}
                    </span>
                  </div>
                ))}
              </div>
              {items.length > 0 && (
                <div className="vm-items-total-row">
                  <span className="vm-items-count">
                    {items.length} item{items.length !== 1 ? 's' : ''} — TOTAL
                  </span>
                  <span className="vm-items-grand-total">{fmt$(grandTotal)}</span>
                </div>
              )}
            </div>

            {/* Warning */}
            <div className="vm-warning">
              <AlertTriangle size={15} color="var(--amber)" className="vm-warning-icon" />
              <span className="vm-warning-text">
                All items will be removed from the register. This cannot be undone.
              </span>
            </div>

            {/* Reason */}
            <input
              className="vm-reason-input"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Reason for void (optional)..."
              autoFocus
            />

            {/* Actions */}
            <div className="vm-actions">
              <button className="vm-btn-cancel" onClick={onClose}>Cancel</button>
              <button
                className={`vm-btn-void${items.length === 0 ? ' vm-btn-void--disabled' : ' vm-btn-void--active'}`}
                onClick={doVoid}
                disabled={items.length === 0}
              >
                <Ban size={16} /> Void Transaction
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
