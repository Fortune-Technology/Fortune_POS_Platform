/**
 * ChangeDueOverlay
 *
 * Full-screen overlay shown after a cash sale completes. Displays the change
 * due (or refund), auto-closes after AUTO_CLOSE_MS, and can be dismissed by
 * any barcode scan via the parent's handleScan (parent should call onClose
 * before processing the scan as a new transaction).
 *
 * Props:
 *   - tx          { txNumber, tenderLines? }   completed transaction
 *   - changeDue   number                       cash change to give back
 *   - isRefund    bool                         true when the tx was a net refund
 *   - onClose     () => void                   called on auto-close, manual tap, or scan interrupt
 *   - onPrint     ?(tx) => void                optional — wire to receipt printer
 */

import React, { useEffect, useState, useRef } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import { fmt$, fmtTxNumber } from '../../utils/formatters.js';
import './ChangeDueOverlay.css';

const AUTO_CLOSE_MS = 5000;

export default function ChangeDueOverlay({ tx, changeDue, isRefund = false, onClose, onPrint }) {
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(AUTO_CLOSE_MS / 1000));
  const closedRef = useRef(false);

  useEffect(() => {
    closedRef.current = false;
    setSecondsLeft(Math.ceil(AUTO_CLOSE_MS / 1000));

    const start = Date.now();
    const tickIv = setInterval(() => {
      const elapsed = Date.now() - start;
      const remain = Math.max(0, Math.ceil((AUTO_CLOSE_MS - elapsed) / 1000));
      setSecondsLeft(remain);
    }, 250);

    const closeTo = setTimeout(() => {
      if (closedRef.current) return;
      closedRef.current = true;
      onClose?.();
    }, AUTO_CLOSE_MS);

    return () => {
      clearInterval(tickIv);
      clearTimeout(closeTo);
    };
  }, [tx?.txNumber, onClose]);

  if (!tx) return null;

  const handleDone = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose?.();
  };
  const handlePrint = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    if (onPrint) onPrint(tx);
    onClose?.();
  };

  const tenderLines = tx.tenderLines || [];
  const multiTender = tenderLines.length > 1;
  const hasCashTender = tenderLines.some(t => t.method === 'cash');

  return (
    <div className="cdo-backdrop" onClick={handleDone}>
      <div className="cdo-card" onClick={e => e.stopPropagation()}>
        <div className={`cdo-header ${isRefund ? 'cdo-header--refund' : ''}`}>
          <div className="cdo-check">
            <Check size={15} strokeWidth={3} />
          </div>
          <span className={`cdo-title ${isRefund ? 'cdo-title--refund' : ''}`}>
            {isRefund ? 'Refund Complete' : 'Sale Complete'}
          </span>
          <span className="cdo-tx">{fmtTxNumber(tx.txNumber)}</span>
        </div>

        <div className="cdo-amount-block">
          <div className="cdo-amount-label">
            {isRefund ? 'REFUND DUE TO CUSTOMER' : 'CHANGE DUE'}
          </div>
          <div className={`cdo-amount ${isRefund ? 'cdo-amount--refund' : ''}`}>
            {fmt$(changeDue || 0)}
          </div>
        </div>

        <div className="cdo-tender-summary">
          {multiTender ? (
            tenderLines.map((t, i) => (
              <div className="cdo-tender-row" key={i}>
                <span>{(t.method || '').replace(/_/g, ' ').toUpperCase()}</span>
                <span>{fmt$(t.amount)}</span>
              </div>
            ))
          ) : tenderLines[0] ? (
            <div className="cdo-tender-row">
              <span>{(tenderLines[0].method || '').replace(/_/g, ' ').toUpperCase()}</span>
              <span>{fmt$(tenderLines[0].amount)}</span>
            </div>
          ) : null}
        </div>

        <div className="cdo-actions">
          {hasCashTender && onPrint ? (
            <>
              <button className="cdo-btn cdo-btn--primary" onClick={handlePrint}>
                <Check size={18} /> Print Receipt &amp; Done
              </button>
              <button className="cdo-btn cdo-btn--ghost" onClick={handleDone}>
                <RefreshCw size={16} /> Skip — New Sale
              </button>
            </>
          ) : (
            <button className="cdo-btn cdo-btn--primary" onClick={handleDone}>
              <RefreshCw size={18} /> Done — New Sale
            </button>
          )}
        </div>

        <div className="cdo-countdown">
          Closing in {secondsLeft}s — scan next item to start a new sale
        </div>
      </div>
    </div>
  );
}
