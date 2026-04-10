/**
 * EndOfDayModal — Manager summary of the day's sales, tenders, and clock events.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { X, BarChart2, Printer, RefreshCw, Clock, DollarSign, CreditCard, Leaf } from 'lucide-react';
import { getEndOfDayReport } from '../../api/pos.js';
import { fmt$ } from '../../utils/formatters.js';
import { useAuthStore } from '../../stores/useAuthStore.js';
import { useHardware } from '../../hooks/useHardware.js';
import { ESCPOS } from '../../services/printerService.js';
import './EndOfDayModal.css';

// ── Build ESC/POS EOD report string ─────────────────────────────────────────
function buildEODString(report, today) {
  const W   = 42;
  const LF  = '\x0A';
  const line = (left, right) => {
    const r = String(right || '');
    const l = String(left  || '').substring(0, W - r.length).padEnd(W - r.length);
    return l + r + LF;
  };
  const centre = (text) => {
    const t = String(text || '');
    const pad = Math.max(0, Math.floor((W - t.length) / 2));
    return ' '.repeat(pad) + t + LF;
  };
  const dashes = () => '-'.repeat(W) + LF;

  let r = '';
  r += ESCPOS.INIT;
  r += ESCPOS.ALIGN_CENTER;
  r += ESCPOS.BOLD_ON + ESCPOS.DOUBLE_SIZE;
  r += 'END OF DAY REPORT' + LF;
  r += ESCPOS.NORMAL_SIZE + ESCPOS.BOLD_OFF;
  r += today + LF;
  r += LF;
  r += ESCPOS.ALIGN_LEFT;
  r += dashes();
  r += ESCPOS.BOLD_ON;
  r += line('NET SALES', fmt$(report.netSales));
  r += ESCPOS.BOLD_OFF;
  r += line('Gross Sales',  fmt$(report.totalSales));
  r += line('Tax Collected', fmt$(report.totalTax));
  r += line('Refunds',       fmt$(report.totalRefunds || 0));
  r += dashes();
  r += line('Transactions', String(report.transactionCount || 0));
  r += line('Refunds',      String(report.refundCount      || 0));
  r += line('Voided',       String(report.voidedCount      || 0));
  r += dashes();
  r += ESCPOS.BOLD_ON + 'TENDER BREAKDOWN' + LF + ESCPOS.BOLD_OFF;
  const tenders = report.tenderBreakdown || {};
  Object.entries(tenders).forEach(([method, amount]) => {
    r += line('  ' + method.replace(/_/g, ' ').toUpperCase(), fmt$(amount));
  });
  r += dashes();
  if (report.cashierBreakdown?.length > 0) {
    r += ESCPOS.BOLD_ON + 'BY CASHIER' + LF + ESCPOS.BOLD_OFF;
    report.cashierBreakdown.forEach(c => {
      r += line('  ' + (c.name || ''), `${c.count} txns  ${fmt$(c.total)}`);
    });
    r += dashes();
  }
  if (report.clockEvents?.length > 0) {
    r += ESCPOS.BOLD_ON + 'CLOCK EVENTS' + LF + ESCPOS.BOLD_OFF;
    report.clockEvents.forEach(e => {
      const d   = new Date(e.createdAt);
      const h   = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
      const t   = `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
      const lbl = e.type === 'in' ? 'IN ' : 'OUT';
      r += line(`  ${lbl}  ${e.userName || ''}`, t);
    });
    r += dashes();
  }
  r += ESCPOS.ALIGN_CENTER;
  r += centre('*** END OF REPORT ***');
  r += ESCPOS.FEED_3;
  r += ESCPOS.CUT_PARTIAL;
  return r;
}

const TENDER_ICON  = { cash: DollarSign, card: CreditCard, ebt: Leaf, manual_card: CreditCard, manual_ebt: Leaf };
const TENDER_COLOR = { cash:'var(--green)', card:'var(--blue)', ebt:'#34d399', manual_card:'var(--blue)', manual_ebt:'#34d399' };

function fmt12(ts) {
  const d = new Date(ts);
  const h = d.getHours(), m = String(d.getMinutes()).padStart(2,'0');
  return `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
}

export default function EndOfDayModal({ onClose }) {
  const cashier = useAuthStore(s => s.cashier);
  const storeId = cashier?.storeId;
  const today   = new Date().toISOString().split('T')[0];

  const [report,   setReport]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [printing, setPrinting] = useState(false);

  const { hasReceiptPrinter, hw, isElectron: isElec } = useHardware();

  const load = useCallback(async () => {
    setLoading(true);
    try { setReport(await getEndOfDayReport(storeId, today)); }
    catch { setReport(null); }
    finally { setLoading(false); }
  }, [storeId, today]);

  useEffect(() => { load(); }, [load]);

  const handlePrint = useCallback(async () => {
    if (!report) return;
    if (!hasReceiptPrinter || !hw?.receiptPrinter) return;
    setPrinting(true);
    try {
      const escpos  = buildEODString(report, today);
      const printer = hw.receiptPrinter;
      if (isElec) {
        if (printer.type === 'network') {
          await window.electronAPI.printNetwork(printer.ip, printer.port || 9100, escpos);
        } else {
          await window.electronAPI.printUSB(printer.name, escpos);
        }
      } else if (printer.type === 'network') {
        const api = (await import('../../api/client.js')).default;
        await api.post('/pos-terminal/print-network', {
          ip: printer.ip, port: printer.port || 9100,
          data: btoa(unescape(encodeURIComponent(escpos))),
        });
      }
    } catch (err) {
      console.warn('EOD print failed:', err.message);
    } finally {
      setPrinting(false);
    }
  }, [report, hasReceiptPrinter, hw, isElec, today]);

  return (
    <div className="eod-backdrop">
      <div className="eod-modal">
        {/* Header */}
        <div className="eod-header">
          <div className="eod-header-left">
            <BarChart2 size={16} color="var(--green)" />
            <div>
              <div className="eod-header-title">End of Day Report</div>
              <div className="eod-header-date">{today}</div>
            </div>
          </div>
          <div className="eod-header-actions">
            <button className="eod-icon-btn" onClick={load} title="Refresh"><RefreshCw size={15} /></button>
            {hasReceiptPrinter && (
              <button
                className={`eod-icon-btn${printing ? ' eod-icon-btn--printing' : ''}${!report ? ' eod-icon-btn--disabled' : ''}`}
                onClick={handlePrint}
                disabled={printing || !report}
                title="Print to receipt printer"
              >
                <Printer size={15} />
              </button>
            )}
            <button className="eod-icon-btn" onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        <div className="eod-body">
          {loading ? (
            <div className="eod-loading">Loading...</div>
          ) : !report ? (
            <div className="eod-error">Unable to load report</div>
          ) : (
            <div className="eod-content">
              {/* Net sales */}
              <div className="eod-net-card">
                <div className="eod-net-label">NET SALES</div>
                <div className="eod-net-value">{fmt$(report.netSales)}</div>
                <div className="eod-net-stats">
                  <span>{report.transactionCount} sales</span>
                  <span className="eod-net-stats-sep">-</span>
                  <span>{report.refundCount} refunds</span>
                  <span className="eod-net-stats-sep">-</span>
                  <span>{report.voidedCount} voided</span>
                </div>
              </div>

              {/* Key metrics */}
              <div className="eod-metrics">
                {[
                  { label:'Gross Sales', value:fmt$(report.totalSales),   color:'var(--text-primary)' },
                  { label:'Tax',         value:fmt$(report.totalTax),     color:'var(--text-secondary)' },
                  { label:'Refunds',     value:fmt$(report.totalRefunds), color:'var(--amber)' },
                ].map(m => (
                  <div key={m.label} className="eod-metric">
                    <div className="eod-metric-label">{m.label}</div>
                    <div className="eod-metric-value" style={{ color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Tender breakdown */}
              <div className="eod-section">
                <div className="eod-section-header">TENDER BREAKDOWN</div>
                {Object.entries(report.tenderBreakdown || {}).map(([method, amount]) => {
                  const Icon  = TENDER_ICON[method] || DollarSign;
                  const color = TENDER_COLOR[method] || 'var(--text-secondary)';
                  return (
                    <div key={method} className="eod-section-row">
                      <Icon size={14} color={color} />
                      <span className="eod-section-row-label">{method.replace('_',' ')}</span>
                      <span className="eod-section-row-value" style={{ color }}>{fmt$(amount)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Cashier breakdown */}
              {report.cashierBreakdown?.length > 0 && (
                <div className="eod-section">
                  <div className="eod-section-header">BY CASHIER</div>
                  {report.cashierBreakdown.map((c, i) => (
                    <div key={i} className="eod-cashier-row">
                      <span className="eod-cashier-name">{c.name}</span>
                      <span className="eod-cashier-count">{c.count} txns</span>
                      <span className="eod-cashier-total">{fmt$(c.total)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Clock events */}
              {report.clockEvents?.length > 0 && (
                <div className="eod-section">
                  <div className="eod-section-header">
                    <Clock size={13} color="var(--text-muted)" />
                    CLOCK EVENTS
                  </div>
                  {report.clockEvents.map((e, i) => (
                    <div key={i} className="eod-clock-row">
                      <span className={`eod-clock-badge${e.type === 'in' ? ' eod-clock-badge--in' : ' eod-clock-badge--out'}`}>
                        {e.type.toUpperCase()}
                      </span>
                      <span className="eod-clock-name">{e.userName}</span>
                      <span className="eod-clock-time">{fmt12(e.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="eod-footer">
          <button className="eod-close-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
