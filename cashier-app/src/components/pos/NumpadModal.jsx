/**
 * NumpadModal — touch-screen-friendly numpad for quantity and price entry.
 */

import React, { useState, useCallback } from 'react';
import { Delete } from 'lucide-react';
import './NumpadModal.css';

// ── Single numpad key ─────────────────────────────────────────────────────────
function Key({ label, onPress, disabled, variant }) {
  return (
    <button
      className={`npm-key ${variant === 'backspace' ? 'npm-key--back' : ''}`}
      disabled={disabled}
      onMouseDown={e => e.preventDefault()}
      onMouseUp={() => { if (!disabled) onPress(); }}
      onTouchStart={e => { e.preventDefault(); }}
      onTouchEnd={e => { e.preventDefault(); if (!disabled) onPress(); }}
    >
      {label}
    </button>
  );
}

// ── NumpadModal ───────────────────────────────────────────────────────────────
export default function NumpadModal({ value = '', onChange, onConfirm, onCancel, mode = 'qty', title = 'Enter Value' }) {
  const isQty = mode === 'qty';

  const handleDigit = useCallback((digit) => {
    const next = value === '0' ? digit : value + digit;
    onChange(next);
  }, [value, onChange]);

  const handleDot = useCallback(() => {
    if (isQty) return;
    if (value.includes('.')) return;
    const next = value === '' ? '0.' : value + '.';
    onChange(next);
  }, [isQty, value, onChange]);

  const handleBackspace = useCallback(() => {
    onChange(value.slice(0, -1));
  }, [value, onChange]);

  const handleConfirm = useCallback(() => {
    if (isQty) {
      const parsed = parseInt(value, 10);
      onConfirm(isNaN(parsed) || parsed <= 0 ? 1 : parsed);
    } else {
      const parsed = parseFloat(value);
      onConfirm(isNaN(parsed) ? 0 : parsed);
    }
  }, [isQty, value, onConfirm]);

  const displayValue = value === '' ? '0' : value;

  return (
    <div className="npm-backdrop" onClick={onCancel}>
      <div className="npm-card" onClick={e => e.stopPropagation()}>
        {/* Title */}
        <div className="npm-title">{title}</div>

        {/* Display */}
        <div className="npm-display">
          {!isQty && <span className="npm-display-prefix">$</span>}
          {displayValue}
        </div>

        {/* Key grid */}
        <div className="npm-grid">
          <Key label="7" onPress={() => handleDigit('7')} />
          <Key label="8" onPress={() => handleDigit('8')} />
          <Key label="9" onPress={() => handleDigit('9')} />
          <Key label="4" onPress={() => handleDigit('4')} />
          <Key label="5" onPress={() => handleDigit('5')} />
          <Key label="6" onPress={() => handleDigit('6')} />
          <Key label="1" onPress={() => handleDigit('1')} />
          <Key label="2" onPress={() => handleDigit('2')} />
          <Key label="3" onPress={() => handleDigit('3')} />
          <Key label="." onPress={handleDot} disabled={isQty} />
          <Key label="0" onPress={() => handleDigit('0')} />
          <Key label={<Delete size={22} />} onPress={handleBackspace} disabled={value === ''} variant="backspace" />
        </div>

        {/* Action buttons */}
        <div className="npm-actions">
          <button onClick={onCancel} className="npm-cancel-btn">Cancel</button>
          <button onClick={handleConfirm} className="npm-confirm-btn">Confirm ✓</button>
        </div>
      </div>
    </div>
  );
}
