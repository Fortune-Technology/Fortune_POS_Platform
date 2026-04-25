/**
 * CouponModal.jsx — Session 46
 *
 * Manufacturer coupon redemption at the register. Replaces the monthly
 * mail-in coupon process with digital tracking that flows directly into
 * the daily scan-data submission.
 *
 * UX flow:
 *   1. Cashier opens modal (via Coupon button or "coupon" Quick Action)
 *   2. Scans / types the coupon serial number
 *   3. Backend validates: serial exists, not expired, not already used,
 *      qualifying UPC in cart, multipack rule met, etc.
 *   4. If valid + threshold not breached → "Apply" applies immediately
 *      If valid + threshold BREACHED → modal flags it; parent flow then
 *      shows the manager-PIN gate before applying
 *   5. On apply, the line item gets the coupon discount baked into its
 *      lineTotal and a CouponRedemption row is queued in cart state
 *
 * Props:
 *   open                : bool
 *   cartItems           : line items (provides upc + lineTotal for backend validate)
 *   existingSerials     : already-redeemed serials in this transaction
 *   thresholds          : { maxVal, maxTotal, maxCount } from POS config
 *   onApply             : (couponPayload) => void
 *                         payload: { coupon, qualifyingLineId, computedDiscount, requiresApproval, approvalReason }
 *                         Parent decides whether to call requireManager()
 *   onClose             : () => void
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, ScanLine, Tag, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';
import { validateCouponAtPOS } from '../../api/pos';
import './CouponModal.css';

const fmtMoney = (n) => `$${Number(n || 0).toFixed(2)}`;

export default function CouponModal({
  open,
  cartItems = [],
  existingSerials = [],
  thresholds = { maxVal: 5, maxTotal: 10, maxCount: 5 },
  onApply,
  onClose,
}) {
  const [serial, setSerial] = useState('');
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [selectedLineId, setSelectedLineId] = useState(null);
  const inputRef = useRef(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSerial('');
      setValidation(null);
      setErr(null);
      setSelectedLineId(null);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  if (!open) return null;

  // ── Validate against backend ─────────────────────────────────────────────
  const runValidate = async (rawSerial) => {
    const trimmed = String(rawSerial || '').trim();
    if (!trimmed) return;

    setLoading(true);
    setErr(null);
    setValidation(null);

    try {
      const cartPayload = cartItems
        .filter(i => i.upc && !i.isLottery && !i.isFuel && !i.isBottleReturn)
        .map(i => ({
          lineId:    i.lineId,
          upc:       i.upc,
          qty:       i.qty,
          lineTotal: i.lineTotal,
        }));

      const res = await validateCouponAtPOS({
        serial:          trimmed,
        cartItems:       cartPayload,
        existingSerials,
      });

      setValidation(res);
      if (res.valid && res.qualifyingLines?.length > 0) {
        // Pre-select the first qualifying line
        setSelectedLineId(res.qualifyingLines[0].lineId);
      }
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const onScanInput = (e) => {
    setSerial(e.target.value);
  };

  const onScanSubmit = (e) => {
    e.preventDefault();
    runValidate(serial);
  };

  // Numpad helper for digit-only coupon entry
  const onKey = (key) => {
    if (key === 'C')      { setSerial(''); setValidation(null); return; }
    if (key === '⌫')      { setSerial(s => s.slice(0, -1)); return; }
    if (key === 'GO')     { runValidate(serial); return; }
    setSerial(s => s + key);
  };

  // ── Apply with threshold awareness ───────────────────────────────────────
  const apply = () => {
    if (!validation?.valid || !selectedLineId) return;
    onApply({
      coupon:           validation.coupon,
      qualifyingLineId: selectedLineId,
      computedDiscount: validation.computedDiscount,
      requiresApproval: validation.requiresApproval,
      approvalReason:   validation.approvalReason,
    });
    // Modal stays open — parent closes it after manager-PIN gate or immediate apply.
    // Reset for the next coupon (cashiers often scan multiple in a row).
    setSerial('');
    setValidation(null);
    setSelectedLineId(null);
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  // ── UI ─────────────────────────────────────────────────────────────────
  const v = validation;
  const cumulativeAfter = (() => {
    if (!v?.computedDiscount) return null;
    const existing = existingSerials.length;
    return {
      count: existing + 1,
      countOver: existing + 1 > thresholds.maxCount,
    };
  })();

  return (
    <div className="cpm-backdrop" onClick={onClose}>
      <div className="cpm-modal" onClick={e => e.stopPropagation()}>
        <div className="cpm-head">
          <div className="cpm-title">
            <ScanLine size={18} />
            <span>Manufacturer Coupon</span>
          </div>
          <button className="cpm-icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="cpm-body">
          <form onSubmit={onScanSubmit} className="cpm-scan-form">
            <label className="cpm-label">Scan or enter coupon serial</label>
            <div className="cpm-scan-row">
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className="cpm-scan-input"
                value={serial}
                onChange={onScanInput}
                placeholder="028200001047"
              />
              <button
                type="submit"
                className="cpm-validate-btn"
                disabled={!serial || loading}
              >
                {loading ? '…' : 'Check'}
              </button>
            </div>
          </form>

          {/* Numpad fallback — useful when no barcode reader handy */}
          <div className="cpm-numpad">
            {['1','2','3','4','5','6','7','8','9','C','0','⌫'].map(k => (
              <button
                key={k}
                type="button"
                className={`cpm-key ${k === 'C' || k === '⌫' ? 'cpm-key--alt' : ''}`}
                onClick={() => onKey(k)}
              >
                {k}
              </button>
            ))}
            <button
              type="button"
              className="cpm-key cpm-key--go"
              onClick={() => onKey('GO')}
              disabled={!serial || loading}
            >
              {loading ? '…' : 'CHECK'}
            </button>
          </div>

          {err && (
            <div className="cpm-banner cpm-banner--err">
              <AlertCircle size={14} />
              <span>{err}</span>
            </div>
          )}

          {/* Validation result */}
          {v && (
            <div className={`cpm-result ${v.valid ? 'cpm-result--ok' : 'cpm-result--bad'}`}>
              {v.valid ? (
                <>
                  <div className="cpm-result-head">
                    <CheckCircle2 size={16} />
                    <strong>{v.coupon.brandFamily}</strong>
                    {v.coupon.displayName && <span className="cpm-result-display">— {v.coupon.displayName}</span>}
                  </div>
                  <div className="cpm-result-meta">
                    <span>
                      {v.coupon.discountType === 'percent'
                        ? `${Number(v.coupon.discountAmount).toFixed(0)}% off`
                        : `${fmtMoney(v.coupon.discountAmount)} off`}
                    </span>
                    <span>·</span>
                    <span>Computed discount: <strong>{fmtMoney(v.computedDiscount)}</strong></span>
                  </div>

                  {/* Qualifying lines picker */}
                  <label className="cpm-label cpm-label--sub">Apply to:</label>
                  <div className="cpm-line-list">
                    {v.qualifyingLines.map(ql => {
                      const cartLine = cartItems.find(i => i.lineId === ql.lineId);
                      return (
                        <button
                          key={ql.lineId}
                          type="button"
                          className={`cpm-line-row ${selectedLineId === ql.lineId ? 'cpm-line-row--active' : ''}`}
                          onClick={() => setSelectedLineId(ql.lineId)}
                        >
                          <div className="cpm-line-name">
                            {cartLine?.name || `UPC ${ql.upc}`}
                          </div>
                          <div className="cpm-line-meta">
                            qty {ql.qty} · {fmtMoney(ql.lineTotal)}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Threshold breach warning */}
                  {v.requiresApproval && (
                    <div className="cpm-banner cpm-banner--warn">
                      <AlertCircle size={14} />
                      <span>
                        <strong>Manager approval required.</strong> {v.approvalReason}
                      </span>
                    </div>
                  )}
                  {!v.requiresApproval && cumulativeAfter?.countOver && (
                    <div className="cpm-banner cpm-banner--warn">
                      <AlertCircle size={14} />
                      <span>This will exceed the per-tx coupon-count limit ({thresholds.maxCount}).</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="cpm-result-head">
                    <AlertCircle size={16} />
                    <strong>Cannot apply</strong>
                  </div>
                  <div className="cpm-result-reason">{v.reason}</div>
                </>
              )}
            </div>
          )}

          {/* Already-applied list */}
          {existingSerials.length > 0 && (
            <div className="cpm-existing">
              <div className="cpm-label cpm-label--sub">Already applied this transaction:</div>
              <div className="cpm-existing-list">
                {existingSerials.map(s => (
                  <span key={s} className="cpm-existing-chip"><Tag size={11} /> {s}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="cpm-foot">
          <button className="cpm-btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="cpm-btn-primary"
            disabled={!v?.valid || !selectedLineId}
            onClick={apply}
          >
            {v?.requiresApproval ? 'Apply (manager PIN)' : 'Apply Coupon'}
          </button>
        </div>
      </div>
    </div>
  );
}
