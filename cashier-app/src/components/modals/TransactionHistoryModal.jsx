/**
 * TransactionHistoryModal — Browse past transactions with date picker, search, filter.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, Printer, Eye, RefreshCw, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { listTransactions } from '../../api/pos.js';
import { fmt$ } from '../../utils/formatters.js';
import { useAuthStore } from '../../stores/useAuthStore.js';
import './TransactionHistoryModal.css';

const STATUS_COLOR = { complete: 'var(--green)', voided: 'var(--red)', refund: 'var(--amber)', suspended: 'var(--text-muted)' };

function fmtDuration(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ${min % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function toLocalDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return toLocalDateStr(d);
}

export default function TransactionHistoryModal({ onClose, onPrintTx, onViewTx }) {
  const cashier = useAuthStore(s => s.cashier);
  const storeId = cashier?.storeId;
  const today = toLocalDateStr(new Date());

  const [date, setDate] = useState(today);
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [detail, setDetail] = useState(null);

  const load = useCallback(async (d) => {
    setLoading(true);
    try { setTxs((await listTransactions({ storeId, date: d || date, limit: 300 })).transactions || []); }
    catch { setTxs([]); }
    finally { setLoading(false); }
  }, [storeId, date]);

  useEffect(() => { load(date); }, [date]);

  const visible = txs.filter(t => {
    if (filter !== 'all' && t.status !== filter) return false;
    if (search) { const q = search.toLowerCase(); return t.txNumber?.toLowerCase().includes(q) || t.cashierName?.toLowerCase().includes(q); }
    return true;
  });

  const totals = visible.reduce((acc, t) => {
    if (t.status === 'complete') acc.sales += t.grandTotal;
    if (t.status === 'refund') acc.refunds += Math.abs(t.grandTotal);
    if (t.status === 'voided') acc.voided++;
    return acc;
  }, { sales: 0, refunds: 0, voided: 0 });

  const isToday = date === today;

  return (
    <div className="thm-backdrop">
      <div className="thm-modal">

        {/* Header */}
        <div className="thm-header">
          <div>
            <div className="thm-header-title">Transaction History</div>
            <div className="thm-header-sub">{txs.length} transaction{txs.length !== 1 ? 's' : ''} - {date}</div>
          </div>
          <div className="thm-header-actions">
            <button className="thm-icon-btn" onClick={() => load(date)} title="Refresh">
              <RefreshCw size={15} />
            </button>
            <button className="thm-icon-btn" onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        {/* Date navigation */}
        <div className="thm-date-bar">
          <button className="thm-date-nav-btn" onClick={() => setDate(d => shiftDate(d, -1))}><ChevronLeft size={15} /></button>
          <div className="thm-date-input-wrap">
            <Calendar size={13} color="var(--text-muted)" />
            <input className="thm-date-input" type="date" value={date} max={today} onChange={e => setDate(e.target.value)} />
          </div>
          <button className={`thm-date-nav-btn${isToday ? ' thm-date-nav-btn--disabled' : ''}`} onClick={() => setDate(d => shiftDate(d, 1))} disabled={isToday}><ChevronRight size={15} /></button>
          {!isToday && <button className="thm-today-btn" onClick={() => setDate(today)}>Today</button>}
        </div>

        {/* Summary bar */}
        <div className="thm-summary-bar">
          {[
            { label: 'Net Sales', value: fmt$(totals.sales - totals.refunds), color: 'var(--green)' },
            { label: 'Refunds', value: fmt$(totals.refunds), color: 'var(--amber)' },
            { label: 'Voided', value: String(totals.voided), color: 'var(--red)' },
          ].map(item => (
            <div key={item.label}>
              <div className="thm-summary-label">{item.label}</div>
              <div className="thm-summary-value" style={{ color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* Search + filter */}
        <div className="thm-filter-bar">
          <div className="thm-search-wrap">
            <Search size={14} color="var(--text-muted)" />
            <input className="thm-search-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by TX# or cashier..." />
          </div>
          {['all','complete','refund','voided'].map(f => (
            <button key={f} className={`thm-filter-btn${filter === f ? ' thm-filter-btn--active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>

        {/* Transaction list */}
        <div className="thm-list">
          {loading ? (
            <div className="thm-loading"><RefreshCw size={16} /> Loading...</div>
          ) : visible.length === 0 ? (
            <div className="thm-empty">No transactions found for {date}</div>
          ) : visible.map(tx => (
            <div key={tx.id} className="thm-tx-row">
              <div className="thm-tx-clickable" onClick={() => setDetail(tx)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div>
                    <span className="thm-tx-number">{tx.txNumber}</span>
                    <span className="thm-tx-status" style={{ background: `${STATUS_COLOR[tx.status]}20`, color: STATUS_COLOR[tx.status] }}>{tx.status.toUpperCase()}</span>
                  </div>
                  <div className="thm-tx-meta">{tx.cashierName} - {fmtDuration(tx.createdAt)} - {(tx.lineItems || []).length} items</div>
                </div>
                <div className="thm-tx-total">
                  <div className={`thm-tx-amount${tx.status === 'voided' ? ' thm-tx-amount--voided' : tx.grandTotal < 0 ? ' thm-tx-amount--negative' : ' thm-tx-amount--normal'}`}>
                    {tx.grandTotal < 0 ? '-' : ''}{fmt$(Math.abs(tx.grandTotal))}
                  </div>
                  <div className="thm-tx-tender">{(tx.tenderLines || []).map(l => l.method).join(' + ')}</div>
                </div>
                <ChevronRight size={13} color="var(--text-muted)" />
              </div>
              <div className="thm-tx-actions">
                <button className="thm-action-btn" onClick={() => setDetail(tx)}><Eye size={11} /> View</button>
                {tx.status !== 'voided' && onPrintTx && (
                  <button className="thm-action-btn thm-action-btn--print" onClick={() => onPrintTx(tx)}><Printer size={11} /> Print</button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Detail panel overlay */}
        {detail && (
          <div className="thm-detail-panel">
            <div className="thm-header">
              <div>
                <div className="thm-header-title">{detail.txNumber}</div>
                <div className="thm-header-sub">{detail.cashierName} - {new Date(detail.createdAt).toLocaleString()}</div>
              </div>
              <div className="thm-detail-header-actions">
                {onViewTx && detail.status !== 'voided' && (
                  <button className="thm-detail-receipt-btn" onClick={() => onViewTx(detail)}><Eye size={13} /> Receipt</button>
                )}
                {detail.status !== 'voided' && onPrintTx && (
                  <button className="thm-detail-print-btn" onClick={() => { onPrintTx(detail); setDetail(null); }}><Printer size={14} /> Print</button>
                )}
                <button className="thm-icon-btn" onClick={() => setDetail(null)} title="Back to list"><X size={16} /></button>
              </div>
            </div>

            <div className="thm-detail-body">
              <div className="thm-detail-status">
                <span className="thm-detail-status-badge" style={{ background: `${STATUS_COLOR[detail.status]}20`, color: STATUS_COLOR[detail.status] }}>{detail.status.toUpperCase()}</span>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div className="thm-detail-section-label">ITEMS</div>
                {(detail.lineItems || []).map((item, i) => (
                  <div key={i} className="thm-detail-item-row">
                    <span className="thm-detail-item-name">{item.qty > 1 ? `${item.qty}x ` : ''}{item.name}</span>
                    <span className="thm-detail-item-total">{fmt$(item.lineTotal)}</span>
                  </div>
                ))}
              </div>

              <div className="thm-detail-totals-card">
                <div className="thm-detail-total-row">
                  <span className="thm-detail-total-label">Total</span>
                  <span className="thm-detail-total-amount">{fmt$(Math.abs(detail.grandTotal))}</span>
                </div>
                {(detail.tenderLines || []).map((l, i) => (
                  <div key={i} className="thm-detail-tender-row">
                    <span>{l.method.replace('_',' ').toUpperCase()}</span>
                    <span className="thm-detail-tender-amount">{fmt$(l.amount)}</span>
                  </div>
                ))}
                {detail.changeGiven > 0 && (
                  <div className="thm-detail-change-row">
                    <span>Change Given</span>
                    <span>{fmt$(detail.changeGiven)}</span>
                  </div>
                )}
              </div>

              {detail.notes && <div className="thm-detail-notes">{detail.notes}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
