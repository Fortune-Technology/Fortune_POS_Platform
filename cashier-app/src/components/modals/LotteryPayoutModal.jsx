/**
 * LotteryPayoutModal — light-theme modal for adding lottery payouts to the cart.
 * Payouts are negative line items so the cart total decreases (cash given to customer).
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useCartStore } from '../../stores/useCartStore.js';
import './LotteryPayoutModal.css';

const NUMPAD = ['7','8','9','4','5','6','1','2','3','.','0','⌫'];
const PRESETS = [5, 10, 20, 50, 100, 200];

export default function LotteryPayoutModal({ open, onClose }) {
  const addLotteryItem = useCartStore(s => s.addLotteryItem);
  const [display, setDisplay] = useState('0');
  const [note,    setNote]    = useState('');
  const [added,   setAdded]   = useState([]);

  if (!open) return null;

  const handleKey = (key) => {
    setDisplay(prev => {
      if (key === '⌫') return prev.length > 1 ? prev.slice(0, -1) : '0';
      if (key === '.') return prev.includes('.') ? prev : prev + '.';
      if (prev === '0') return key;
      if (prev.includes('.') && prev.split('.')[1].length >= 2) return prev;
      return prev + key;
    });
  };

  const amount = parseFloat(display) || 0;

  const handleAdd = () => {
    if (amount <= 0) return;
    addLotteryItem({ lotteryType: 'payout', amount, notes: note.trim() || undefined });
    setAdded(a => [...a, { amount, note: note.trim() }]);
    setDisplay('0');
    setNote('');
  };

  const handleDone = () => {
    setAdded([]);
    setDisplay('0');
    setNote('');
    onClose();
  };

  return (
    <div className="lpm-backdrop">
      <div className="lpm-modal">
        {/* Header */}
        <div className="lpm-header">
          <div className="lpm-header-left">
            <div className="lpm-header-icon">Payout</div>
            <div>
              <div className="lpm-header-title">Lottery Payout</div>
              <div className="lpm-header-sub">Cash paid to winning customer</div>
            </div>
          </div>
          <button className="lpm-close-btn" onClick={handleDone}><X size={20} /></button>
        </div>

        <div className="lpm-body">
          {/* Amount display */}
          <div className="lpm-display">
            <span className="lpm-display-value">${display}</span>
          </div>

          {/* Quick presets */}
          <div className="lpm-presets">
            {PRESETS.map(p => (
              <button key={p} className="lpm-preset-btn" onClick={() => setDisplay(String(p))}>
                ${p}
              </button>
            ))}
          </div>

          {/* Numpad */}
          <div className="lpm-numpad">
            {NUMPAD.map(k => (
              <button
                key={k}
                className={`lpm-numkey${k === '⌫' ? ' lpm-numkey--backspace' : ''}`}
                onClick={() => handleKey(k)}
              >{k}</button>
            ))}
          </div>

          {/* Note */}
          <input
            type="text"
            className="lpm-note-input"
            placeholder="Note — e.g. winning ticket #12345 (optional)"
            value={note}
            onChange={e => setNote(e.target.value)}
          />

          {/* Add button */}
          <button
            className={`lpm-add-btn${amount > 0 ? ' lpm-add-btn--active' : ' lpm-add-btn--disabled'}`}
            onClick={handleAdd}
            disabled={amount <= 0}
          >
            Add Payout — {`$${amount.toFixed(2)}`} to Cart
          </button>

          {/* Added preview */}
          {added.length > 0 && (
            <div className="lpm-added-list">
              <div className="lpm-added-label">Added to Cart</div>
              {added.map((a, i) => (
                <div key={i} className="lpm-added-row">
                  <span>Payout{a.note ? ` — ${a.note}` : ''}</span>
                  <span className="lpm-added-amount">-${a.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {added.length > 0 && (
            <button className="lpm-done-btn" onClick={handleDone}>
              Done — {added.length} payout{added.length > 1 ? 's' : ''} in cart
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
