/**
 * NumPadInline — phone-style on-screen numpad for touchscreen POS.
 *
 * ENTRY MODEL: digits push in from the right (like a credit-card terminal).
 *   Enter "589"  -> displays "$5.89"
 *   Backspace    -> "$0.58"
 *   Enter "1"    -> displays "$0.01"
 *   Enter "10000"-> displays "$100.00"
 *
 * Keys:  7  8  9
 *        4  5  6
 *        1  2  3
 *        00  0  backspace
 *
 * Props:
 *   value       {string}  raw digit string, e.g. "589"
 *   onChange    {fn}      receives new raw digit string
 *   accentColor {string}  color for the prefix sign & active state
 *   prefix      {string}  "$" (default) | "%" | any symbol
 *   decimals    {number}  2 = implied cents (default), 0 = integer (% discount)
 *   maxDigits   {number}  max digit count, default 7 ($99,999.99)
 */

import React, { useState } from 'react';
import { Delete } from 'lucide-react';
import './NumPadInline.css';

// ── Helpers (exported so parents can derive numeric values) ───────────────────

/** "589" -> "5.89"  |  decimals=0 -> "589" */
export function digitsToDisplay(digits, decimals = 2) {
  if (decimals === 0) return digits || '0';
  const n = parseInt(digits || '0', 10);
  return (n / Math.pow(10, decimals)).toFixed(decimals);
}

/** "589" -> 5.89  |  decimals=0 -> 589 */
export function digitsToNumber(digits, decimals = 2) {
  if (!digits) return 0;
  if (decimals === 0) return parseInt(digits, 10) || 0;
  return parseInt(digits, 10) / Math.pow(10, decimals);
}

/** dollar number -> digit string: 26.94 -> "2694" */
export function numberToDigits(n, decimals = 2) {
  return String(Math.round(n * Math.pow(10, decimals)));
}

// ── Single key ────────────────────────────────────────────────────────────────
export function NKey({ label, onPress, disabled = false, variant }) {
  return (
    <button
      disabled={disabled}
      onMouseDown={e => e.preventDefault()}
      onMouseUp={() => { if (!disabled) onPress(); }}
      onTouchStart={e => { e.preventDefault(); }}
      onTouchEnd={e => { e.preventDefault(); if (!disabled) onPress(); }}
      className={`npi-key ${variant === 'back' ? 'npi-key--back' : ''}`}
    >
      {label}
    </button>
  );
}

// ── NumPadInline ──────────────────────────────────────────────────────────────
export default function NumPadInline({
  value       = '',
  onChange,
  accentColor = 'var(--green)',
  prefix      = '$',
  decimals    = 2,
  maxDigits   = 7,
}) {
  const appendDigit = (d) => {
    if (value.length >= maxDigits) return;
    onChange(value + d);
  };

  const appendDoubleZero = () => {
    if (!value) return;
    if (value.length + 2 > maxDigits) return;
    onChange(value + '00');
  };

  const backspace = () => onChange(value.slice(0, -1));

  const display = digitsToDisplay(value, decimals);
  const isEmpty = !value || parseInt(value, 10) === 0;

  return (
    <div className="npi-wrap">
      {/* Display */}
      <div className="npi-display">
        <span
          className={`npi-prefix ${isEmpty ? 'npi-prefix--empty' : ''}`}
          style={!isEmpty ? { color: accentColor } : undefined}
        >
          {prefix}
        </span>
        <span className={`npi-value ${isEmpty ? 'npi-value--empty' : 'npi-value--active'}`}>
          {display}
        </span>
      </div>

      {/* Key grid */}
      <div className="npi-grid">
        {['7','8','9','4','5','6','1','2','3'].map(d => (
          <NKey key={d} label={d} onPress={() => appendDigit(d)} />
        ))}
        <NKey label="00" onPress={appendDoubleZero} disabled={!value} />
        <NKey label="0"  onPress={() => appendDigit('0')} />
        <NKey label={<Delete size={20} />} onPress={backspace} disabled={!value} variant="back" />
      </div>
    </div>
  );
}
