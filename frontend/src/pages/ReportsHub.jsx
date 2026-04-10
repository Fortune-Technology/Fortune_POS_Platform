/**
 * ReportsHub.jsx — Comprehensive Store Reports Page
 *
 * Tabs: Summary | Tender | Sales | Day | Tax | Inventory | Compare | Expenses
 *
 * Uses shared portal.css classes (p-*) + page-specific ReportsHub.css (rh-*).
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart2, Download, FileText, RefreshCw, Filter,
  TrendingUp, TrendingDown, Minus, AlertCircle, Loader,
  DollarSign, ShoppingCart, Percent, CreditCard, Users,
  Package, Calendar, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { toast } from 'react-toastify';
import { getReportSummary, getReportTax, getReportInventory, getReportCompare } from '../services/api';
import { downloadCSV, downloadPDF } from '../utils/exportUtils';
import '../styles/portal.css';
import './ReportsHub.css';

/* ── helpers ──────────────────────────────────────────────────────────────── */
const fmt    = (n) => n == null ? '--' : `$${Number(n).toFixed(2)}`;
const fmtNum = (n) => n == null ? '--' : Number(n).toLocaleString();
const pct    = (n) => n == null ? '--' : `${Number(n).toFixed(1)}%`;

const toDateStr  = (d) => d.toISOString().slice(0, 10);
const todayStr   = () => toDateStr(new Date());
const daysAgoStr = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return toDateStr(d); };

const TABS = ['Summary', 'Tender', 'Sales', 'Day', 'Tax', 'Inventory', 'Compare', 'Expenses'];

/* ── Stat Card ────────────────────────────────────────────────────────────── */
function StatCard({ label, value, sub }) {
  return (
    <div className="p-stat-card">
      <div className="p-stat-label">{label}</div>
      <div className="p-stat-value">{value}</div>
      {sub && <div className="p-stat-sub">{sub}</div>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════ */
export default function ReportsHub() {
  const [tab, setTab] = useState('Summary');

  /* shared date range */
  const [from, setFrom]   = useState(daysAgoStr(30));
  const [to,   setTo]     = useState(todayStr());

  /* data */
  const [summary,   setSummary]   = useState(null);
  const [taxData,   setTaxData]   = useState(null);
  const [invData,   setInvData]   = useState(null);
  const [cmpData,   setCmpData]   = useState(null);

  /* compare periods */
  const [from1, setFrom1] = useState(daysAgoStr(60));
  const [to1,   setTo1]   = useState(daysAgoStr(31));
  const [from2, setFrom2] = useState(daysAgoStr(30));
  const [to2,   setTo2]   = useState(todayStr());

  /* UI state */
  const [loading, setLoading] = useState(false);
  const [invFilter, setInvFilter] = useState('all');

  /* ── Fetch helpers ──────────────────────────────────────────────────────── */
  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getReportSummary({ from, to });
      setSummary(data);
    } catch (e) {
      toast.error('Failed to load summary report');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  const fetchTax = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getReportTax({ from, to });
      setTaxData(data);
    } catch (e) {
      toast.error('Failed to load tax report');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getReportInventory();
      setInvData(data);
    } catch (e) {
      toast.error('Failed to load inventory report');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCompare = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getReportCompare({ from1, to1, from2, to2 });
      setCmpData(data);
    } catch (e) {
      toast.error('Failed to load comparison report');
    } finally {
      setLoading(false);
    }
  }, [from1, to1, from2, to2]);

  /* ── Auto-load on tab switch ────────────────────────────────────────────── */
  useEffect(() => {
    if (['Summary', 'Tender', 'Sales', 'Day', 'Expenses'].includes(tab) && !summary) fetchSummary();
    if (tab === 'Tax' && !taxData) fetchTax();
    if (tab === 'Inventory' && !invData) fetchInventory();
    if (tab === 'Compare' && !cmpData) fetchCompare();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Run button handler ─────────────────────────────────────────────────── */
  const handleRun = () => {
    setSummary(null);
    setTaxData(null);
    setCmpData(null);
    if (['Summary', 'Tender', 'Sales', 'Day', 'Expenses'].includes(tab)) fetchSummary();
    else if (tab === 'Tax') fetchTax();
    else if (tab === 'Inventory') fetchInventory();
    else if (tab === 'Compare') fetchCompare();
  };

  /* ══════════════════════════════════════════════════════════════════════════
     TAB: SUMMARY (P&L)
  ══════════════════════════════════════════════════════════════════════════ */
  const renderSummary = () => {
    if (!summary) return <div className="p-empty">No data loaded. Click Run to fetch report.</div>;
    const s = summary;
    const depts = s.departments || [];
    const totalSales = depts.reduce((a, d) => a + (d.sales || 0), 0) || 1;

    const deptCols = [
      { key: 'department', label: 'Department' },
      { key: 'sales',      label: 'Sales' },
      { key: 'cost',       label: 'Cost' },
      { key: 'profit',     label: 'Profit' },
      { key: 'margin',     label: 'Margin %' },
      { key: 'qty',        label: 'Qty' },
      { key: 'pctTotal',   label: '% of Total' },
    ];

    return (
      <>
        {/* KPI Row */}
        <div className="p-stat-grid">
          <StatCard label="Gross Sales"     value={fmt(s.grossSales)} />
          <StatCard label="Net Sales"       value={fmt(s.netSales)} />
          <StatCard label="Tax Collected"   value={fmt(s.taxCollected)} />
          <StatCard label="Transactions"    value={fmtNum(s.transactions)} />
          <StatCard label="Avg Transaction" value={fmt(s.avgTransaction)} />
          <StatCard label="Gross Margin %"  value={pct(s.grossMarginPct)} />
          <StatCard label="Gross Profit"    value={fmt(s.grossProfit)} />
          <StatCard label="Refunds"         value={fmt(s.refunds)} />
          <StatCard label="Voids"           value={fmt(s.voids)} />
        </div>

        {/* Department Breakdown */}
        <div className="rh-section">
          <div className="rh-section-title">Department Breakdown</div>
          <div className="p-table-wrap">
            <table className="p-table">
              <thead>
                <tr>
                  <th>Department</th><th>Sales</th><th>Cost</th>
                  <th>Profit</th><th>Margin %</th><th>Qty</th><th>% of Total</th>
                </tr>
              </thead>
              <tbody>
                {depts.map((d, i) => (
                  <tr key={i}>
                    <td className="p-td-strong">{d.department || d.name}</td>
                    <td>{fmt(d.sales)}</td>
                    <td>{fmt(d.cost)}</td>
                    <td className={d.profit >= 0 ? 'p-td-green' : 'p-td-red'}>{fmt(d.profit)}</td>
                    <td>{pct(d.margin)}</td>
                    <td>{fmtNum(d.qty)}</td>
                    <td>{pct((d.sales / totalSales) * 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bag Fees / Deposit Fees */}
        <div className="rh-totals-row">
          <div className="rh-total-item">
            <span className="rh-total-label">Bag Fees</span>
            <span className="rh-total-value">{fmt(s.bagFees)}</span>
          </div>
          <div className="rh-total-item">
            <span className="rh-total-label">Deposit Fees</span>
            <span className="rh-total-value">{fmt(s.depositFees)}</span>
          </div>
        </div>

        {/* Export */}
        <div className="rh-export-row">
          <button className="p-btn p-btn-ghost p-btn-sm" onClick={() => downloadCSV(
            depts.map(d => ({ ...d, pctTotal: ((d.sales / totalSales) * 100).toFixed(1) + '%' })),
            deptCols, 'summary-report'
          )}>
            <Download size={14} /> CSV
          </button>
          <button className="p-btn p-btn-ghost p-btn-sm" onClick={() => downloadPDF({
            title: 'Summary P&L Report',
            subtitle: `${from} to ${to}`,
            summary: [
              { label: 'Gross Sales', value: fmt(s.grossSales) },
              { label: 'Net Sales',   value: fmt(s.netSales) },
              { label: 'Tax',         value: fmt(s.taxCollected) },
              { label: 'Transactions', value: fmtNum(s.transactions) },
              { label: 'Gross Profit', value: fmt(s.grossProfit) },
            ],
            data: depts.map(d => ({ ...d, pctTotal: ((d.sales / totalSales) * 100).toFixed(1) + '%' })),
            columns: deptCols,
            filename: 'summary-report',
          })}>
            <FileText size={14} /> PDF
          </button>
        </div>
      </>
    );
  };

  /* ══════════════════════════════════════════════════════════════════════════
     TAB: TENDER
  ══════════════════════════════════════════════════════════════════════════ */
  const renderTender = () => {
    if (!summary) return <div className="p-empty">No data loaded. Click Run to fetch report.</div>;
    const tender = summary.tender || {};
    const methods = tender.methods || [];
    const grandTotal = methods.reduce((a, m) => a + (m.total || 0), 0) || 1;

    const tenderCols = [
      { key: 'method', label: 'Payment Method' },
      { key: 'count',  label: 'Count' },
      { key: 'total',  label: 'Total' },
      { key: 'pctTotal', label: '% of Total' },
    ];

    // Summary cards for major types
    const cardTypes = ['Cash', 'Card', 'EBT', 'Other'];
    const cardData = cardTypes.map(type => {
      const matching = methods.filter(m => (m.method || '').toLowerCase().includes(type.toLowerCase()));
      const total = matching.reduce((a, m) => a + (m.total || 0), 0);
      const count = matching.reduce((a, m) => a + (m.count || 0), 0);
      return { type, total, count, pct: ((total / grandTotal) * 100).toFixed(1) };
    });

    return (
      <>
        {/* Payment type cards */}
        <div className="rh-tender-cards">
          {cardData.map(c => (
            <div className="rh-tender-card" key={c.type}>
              <div className="rh-tender-card-label">{c.type}</div>
              <div className="rh-tender-card-value">{fmt(c.total)}</div>
              <div className="rh-tender-card-sub">{fmtNum(c.count)} txns  |  {c.pct}%</div>
            </div>
          ))}
        </div>

        {/* Full methods table */}
        <div className="rh-section">
          <div className="rh-section-title">All Tender Methods</div>
          <div className="p-table-wrap">
            <table className="p-table">
              <thead>
                <tr><th>Method</th><th>Count</th><th>Total</th><th>% of Total</th></tr>
              </thead>
              <tbody>
                {methods.map((m, i) => (
                  <tr key={i}>
                    <td className="p-td-strong">{m.method}</td>
                    <td>{fmtNum(m.count)}</td>
                    <td>{fmt(m.total)}</td>
                    <td>{pct((m.total / grandTotal) * 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rh-export-row">
          <button className="p-btn p-btn-ghost p-btn-sm" onClick={() => downloadCSV(
            methods.map(m => ({ ...m, pctTotal: ((m.total / grandTotal) * 100).toFixed(1) + '%' })),
            tenderCols, 'tender-report'
          )}>
            <Download size={14} /> CSV
          </button>
          <button className="p-btn p-btn-ghost p-btn-sm" onClick={() => downloadPDF({
            title: 'Tender Report',
            subtitle: `${from} to ${to}`,
            data: methods.map(m => ({ ...m, pctTotal: ((m.total / grandTotal) * 100).toFixed(1) + '%' })),
            columns: tenderCols,
            filename: 'tender-report',
          })}>
            <FileText size={14} /> PDF
          </button>
        </div>
      </>
    );
  };

  /* ══════════════════════════════════════════════════════════════════════════
     TAB: SALES
  ══════════════════════════════════════════════════════════════════════════ */
  const renderSales = () => {
    if (!summary) return <div className="p-empty">No data loaded. Click Run to fetch report.</div>;
    const daily   = summary.dailySales   || [];
    const hourly  = summary.hourlySales  || [];
    const cashiers = summary.byCashier   || [];
    const stations = summary.byStation   || [];

    return (
      <>
        {/* Daily Sales Chart */}
        <div className="rh-chart-wrap">
          <div className="rh-chart-title">Daily Sales</div>
          {daily.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Bar dataKey="sales" fill="var(--accent-primary)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="p-empty">No daily sales data</div>}
        </div>

        {/* Hourly Sales Chart */}
        <div className="rh-chart-wrap">
          <div className="rh-chart-title">Hourly Sales</div>
          {hourly.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={hourly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Bar dataKey="sales" fill="var(--success)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="p-empty">No hourly sales data</div>}
        </div>

        {/* By Cashier */}
        <div className="rh-section">
          <div className="rh-section-title">Sales by Cashier</div>
          <div className="p-table-wrap">
            <table className="p-table">
              <thead><tr><th>Cashier</th><th>Transactions</th><th>Total Sales</th></tr></thead>
              <tbody>
                {cashiers.map((c, i) => (
                  <tr key={i}>
                    <td className="p-td-strong">{c.cashier || c.name}</td>
                    <td>{fmtNum(c.transactions)}</td>
                    <td>{fmt(c.totalSales || c.sales)}</td>
                  </tr>
                ))}
                {!cashiers.length && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No cashier data</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* By Station */}
        <div className="rh-section">
          <div className="rh-section-title">Sales by Station</div>
          <div className="p-table-wrap">
            <table className="p-table">
              <thead><tr><th>Station</th><th>Transactions</th><th>Total Sales</th></tr></thead>
              <tbody>
                {stations.map((s, i) => (
                  <tr key={i}>
                    <td className="p-td-strong">{s.station || s.name}</td>
                    <td>{fmtNum(s.transactions)}</td>
                    <td>{fmt(s.totalSales || s.sales)}</td>
                  </tr>
                ))}
                {!stations.length && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No station data</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rh-export-row">
          <button className="p-btn p-btn-ghost p-btn-sm" onClick={() => downloadCSV(
            daily, [{ key: 'date', label: 'Date' }, { key: 'sales', label: 'Sales' }], 'daily-sales'
          )}>
            <Download size={14} /> Daily CSV
          </button>
          <button className="p-btn p-btn-ghost p-btn-sm" onClick={() => downloadCSV(
            cashiers.map(c => ({ cashier: c.cashier || c.name, transactions: c.transactions, totalSales: c.totalSales || c.sales })),
            [{ key: 'cashier', label: 'Cashier' }, { key: 'transactions', label: 'Transactions' }, { key: 'totalSales', label: 'Total Sales' }],
            'cashier-sales'
          )}>
            <Download size={14} /> Cashier CSV
          </button>
        </div>
      </>
    );
  };

  /* ══════════════════════════════════════════════════════════════════════════
     TAB: DAY
  ══════════════════════════════════════════════════════════════════════════ */
  const renderDay = () => {
    if (!summary) return <div className="p-empty">No data loaded. Click Run to fetch report.</div>;
    const daily = summary.dailySales || [];

    const dayCols = [
      { key: 'date',         label: 'Date' },
      { key: 'sales',        label: 'Sales' },
      { key: 'tax',          label: 'Tax' },
      { key: 'transactions', label: 'Transactions' },
      { key: 'avgTx',        label: 'Avg Tx' },
    ];

    // Color code rows by sales performance
    const maxSales = Math.max(...daily.map(d => d.sales || 0), 1);

    return (
      <>
        <div className="rh-section">
          <div className="rh-section-title">Daily Breakdown</div>
          <div className="p-table-wrap">
            <table className="p-table">
              <thead>
                <tr><th>Date</th><th>Sales</th><th>Tax</th><th>Transactions</th><th>Avg Tx</th></tr>
              </thead>
              <tbody>
                {daily.map((d, i) => {
                  const ratio = (d.sales || 0) / maxSales;
                  const bgAlpha = Math.round(ratio * 15) / 100;
                  return (
                    <tr key={i} style={{ background: `rgba(16, 185, 129, ${bgAlpha})` }}>
                      <td className="p-td-strong">{d.date}</td>
                      <td>{fmt(d.sales)}</td>
                      <td>{fmt(d.tax)}</td>
                      <td>{fmtNum(d.transactions)}</td>
                      <td>{fmt(d.avgTx)}</td>
                    </tr>
                  );
                })}
                {!daily.length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No daily data</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rh-export-row">
          <button className="p-btn p-btn-ghost p-btn-sm" onClick={() => downloadCSV(daily, dayCols, 'day-report')}>
            <Download size={14} /> CSV
          </button>
          <button className="p-btn p-btn-ghost p-btn-sm" onClick={() => downloadPDF({
            title: 'Day Report', subtitle: `${from} to ${to}`, data: daily, columns: dayCols, filename: 'day-report',
          })}>
            <FileText size={14} /> PDF
          </button>
        </div>
      </>
    );
  };

  /* ══════════════════════════════════════════════════════════════════════════
     TAB: TAX
  ══════════════════════════════════════════════════════════════════════════ */
  const renderTax = () => {
    if (!taxData) return <div className="p-empty">No data loaded. Click Run to fetch report.</div>;
    const classes = taxData.classes || [];
    const totalTax = classes.reduce((a, c) => a + (c.taxAmount || 0), 0);

    const taxCols = [
      { key: 'taxClass',     label: 'Tax Class' },
      { key: 'taxableSales', label: 'Taxable Sales' },
      { key: 'rate',         label: 'Rate' },
      { key: 'taxAmount',    label: 'Tax Amount' },
    ];

    return (
      <>
        <div className="p-stat-grid">
          <StatCard label="Total Tax Collected" value={fmt(totalTax)} />
        </div>

        <div className="rh-section">
          <div className="rh-section-title">Tax Classes</div>
          <div className="p-table-wrap">
            <table className="p-table">
              <thead><tr><th>Tax Class</th><th>Taxable Sales</th><th>Rate</th><th>Tax Amount</th></tr></thead>
              <tbody>
                {classes.map((c, i) => (
                  <tr key={i}>
                    <td className="p-td-strong">{c.taxClass || c.name}</td>
                    <td>{fmt(c.taxableSales)}</td>
                    <td>{pct(c.rate)}</td>
                    <td className="p-td-green">{fmt(c.taxAmount)}</td>
                  </tr>
                ))}
                {!classes.length && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No tax data</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rh-export-row">
          <button className="p-btn p-btn-ghost p-btn-sm" onClick={() => downloadCSV(classes, taxCols, 'tax-report')}>
            <Download size={14} /> CSV
          </button>
          <button className="p-btn p-btn-ghost p-btn-sm" onClick={() => downloadPDF({
            title: 'Tax Report', subtitle: `${from} to ${to}`,
            summary: [{ label: 'Total Tax', value: fmt(totalTax) }],
            data: classes, columns: taxCols, filename: 'tax-report',
          })}>
            <FileText size={14} /> PDF
          </button>
        </div>
      </>
    );
  };

  /* ══════════════════════════════════════════════════════════════════════════
     TAB: INVENTORY
  ══════════════════════════════════════════════════════════════════════════ */
  const renderInventory = () => {
    if (!invData) return <div className="p-empty">No data loaded. Click Run to fetch report.</div>;
    const products = invData.products || [];

    const statusBadge = (status) => {
      const map = {
        out:   { cls: 'p-badge-red',    label: 'Out' },
        low:   { cls: 'p-badge-amber',  label: 'Low' },
        dead:  { cls: 'p-badge-gray',   label: 'Dead' },
        over:  { cls: 'p-badge-purple', label: 'Over' },
        ok:    { cls: 'p-badge-green',  label: 'OK' },
      };
      const b = map[status] || map.ok;
      return <span className={`p-badge ${b.cls}`}>{b.label}</span>;
    };

    const filtered = invFilter === 'all'
      ? products
      : products.filter(p => p.status === invFilter);

    const outCount  = products.filter(p => p.status === 'out').length;
    const lowCount  = products.filter(p => p.status === 'low').length;
    const deadCount = products.filter(p => p.status === 'dead').length;
    const overCount = products.filter(p => p.status === 'over').length;
    const totalRetail = products.reduce((a, p) => a + (p.retailValue || 0), 0);
    const totalCost   = products.reduce((a, p) => a + (p.costValue || 0), 0);

    const invCols = [
      { key: 'name',      label: 'Name' },
      { key: 'upc',       label: 'UPC' },
      { key: 'dept',      label: 'Dept' },
      { key: 'onHand',    label: 'On Hand' },
      { key: 'onOrder',   label: 'On Order' },
      { key: 'sold30d',   label: 'Sold (30d)' },
      { key: 'avgDaily',  label: 'Avg Daily' },
      { key: 'daysSupply', label: 'Days Supply' },
      { key: 'status',    label: 'Status' },
      { key: 'retailValue', label: 'Retail Value' },
    ];

    return (
      <>
        <div className="p-stat-grid">
          <StatCard label="Total Products" value={fmtNum(products.length)} />
          <StatCard label="Out of Stock"   value={fmtNum(outCount)} />
          <StatCard label="Low Stock"      value={fmtNum(lowCount)} />
          <StatCard label="Dead Stock"     value={fmtNum(deadCount)} />
          <StatCard label="Over Stock"     value={fmtNum(overCount)} />
          <StatCard label="Total Retail Value" value={fmt(totalRetail)} />
          <StatCard label="Total Cost Value"   value={fmt(totalCost)} />
        </div>

        <div className="rh-inv-filters">
          {[
            { key: 'all', label: 'All' },
            { key: 'low', label: 'Low Stock' },
            { key: 'dead', label: 'Dead Stock' },
            { key: 'over', label: 'Over Stock' },
            { key: 'out', label: 'Out of Stock' },
          ].map(f => (
            <button
              key={f.key}
              className={`p-btn p-btn-ghost p-btn-sm ${invFilter === f.key ? 'rh-filter-active' : ''}`}
              onClick={() => setInvFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="p-table-wrap">
          <table className="p-table">
            <thead>
              <tr>
                <th>Name</th><th>UPC</th><th>Dept</th><th>On Hand</th>
                <th>On Order</th><th>Sold (30d)</th><th>Avg Daily</th>
                <th>Days Supply</th><th>Status</th><th>Retail Value</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={i}>
                  <td className="p-td-strong">{p.name}</td>
                  <td>{p.upc}</td>
                  <td>{p.dept}</td>
                  <td>{fmtNum(p.onHand)}</td>
                  <td>{fmtNum(p.onOrder)}</td>
                  <td>{fmtNum(p.sold30d)}</td>
                  <td>{p.avgDaily != null ? Number(p.avgDaily).toFixed(1) : '--'}</td>
                  <td>{p.daysSupply != null ? fmtNum(p.daysSupply) : '--'}</td>
                  <td>{statusBadge(p.status)}</td>
                  <td>{fmt(p.retailValue)}</td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No products match filter</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="rh-export-row" style={{ marginTop: '1rem' }}>
          <button className="p-btn p-btn-ghost p-btn-sm" onClick={() => downloadCSV(filtered, invCols, 'inventory-report')}>
            <Download size={14} /> CSV
          </button>
          <button className="p-btn p-btn-ghost p-btn-sm" onClick={() => downloadPDF({
            title: 'Inventory Report',
            summary: [
              { label: 'Total Products', value: fmtNum(products.length) },
              { label: 'Out of Stock',   value: fmtNum(outCount) },
              { label: 'Retail Value',   value: fmt(totalRetail) },
            ],
            data: filtered, columns: invCols, filename: 'inventory-report',
          })}>
            <FileText size={14} /> PDF
          </button>
        </div>
      </>
    );
  };

  /* ══════════════════════════════════════════════════════════════════════════
     TAB: COMPARE
  ══════════════════════════════════════════════════════════════════════════ */
  const renderCompare = () => {
    const changeArrow = (val) => {
      if (val == null) return <span className="rh-change-flat"><Minus size={14} /> --</span>;
      const n = Number(val);
      if (n > 0) return <span className="rh-change-up"><ArrowUpRight size={14} /> +{n.toFixed(1)}%</span>;
      if (n < 0) return <span className="rh-change-down"><ArrowDownRight size={14} /> {n.toFixed(1)}%</span>;
      return <span className="rh-change-flat"><Minus size={14} /> 0.0%</span>;
    };

    return (
      <>
        {/* Period selectors */}
        <div className="rh-compare-periods">
          <div className="rh-period-box">
            <div className="rh-period-label">Period 1</div>
            <div className="rh-period-dates">
              <input type="date" className="p-input" value={from1} onChange={e => setFrom1(e.target.value)} />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>to</span>
              <input type="date" className="p-input" value={to1} onChange={e => setTo1(e.target.value)} />
            </div>
          </div>
          <div className="rh-period-box">
            <div className="rh-period-label">Period 2</div>
            <div className="rh-period-dates">
              <input type="date" className="p-input" value={from2} onChange={e => setFrom2(e.target.value)} />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>to</span>
              <input type="date" className="p-input" value={to2} onChange={e => setTo2(e.target.value)} />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <button className="p-btn p-btn-primary p-btn-sm" onClick={() => { setCmpData(null); fetchCompare(); }}>
            <RefreshCw size={14} /> Compare
          </button>
        </div>

        {!cmpData ? (
          <div className="p-empty">Select two periods and click Compare to see results.</div>
        ) : (
          <>
            <div className="p-table-wrap">
              <table className="p-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Period 1</th>
                    <th>Period 2</th>
                    <th>Change %</th>
                  </tr>
                </thead>
                <tbody>
                  {(cmpData.metrics || []).map((m, i) => (
                    <tr key={i}>
                      <td className="p-td-strong">{m.metric}</td>
                      <td>{m.period1}</td>
                      <td>{m.period2}</td>
                      <td>{changeArrow(m.changePct)}</td>
                    </tr>
                  ))}
                  {!(cmpData.metrics || []).length && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No comparison data</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="rh-export-row" style={{ marginTop: '1rem' }}>
              <button className="p-btn p-btn-ghost p-btn-sm" onClick={() => downloadCSV(
                cmpData.metrics || [],
                [{ key: 'metric', label: 'Metric' }, { key: 'period1', label: 'Period 1' }, { key: 'period2', label: 'Period 2' }, { key: 'changePct', label: 'Change %' }],
                'compare-report'
              )}>
                <Download size={14} /> CSV
              </button>
              <button className="p-btn p-btn-ghost p-btn-sm" onClick={() => downloadPDF({
                title: 'Period Comparison',
                subtitle: `Period 1: ${from1} - ${to1}  |  Period 2: ${from2} - ${to2}`,
                data: cmpData.metrics || [],
                columns: [{ key: 'metric', label: 'Metric' }, { key: 'period1', label: 'Period 1' }, { key: 'period2', label: 'Period 2' }, { key: 'changePct', label: 'Change %' }],
                filename: 'compare-report',
              })}>
                <FileText size={14} /> PDF
              </button>
            </div>
          </>
        )}
      </>
    );
  };

  /* ══════════════════════════════════════════════════════════════════════════
     TAB: EXPENSES
  ══════════════════════════════════════════════════════════════════════════ */
  const renderExpenses = () => {
    if (!summary) return <div className="p-empty">No data loaded. Click Run to fetch report.</div>;
    const expenses = summary.expenses || {};
    const expensePayouts = expenses.expensePayouts || 0;
    const merchPayouts   = expenses.merchandisePayouts || 0;
    const combined       = expensePayouts + merchPayouts;

    const lottery = expenses.lottery || {};

    return (
      <>
        <div className="p-stat-grid">
          <StatCard label="Expense Payouts"     value={fmt(expensePayouts)} />
          <StatCard label="Merchandise Payouts"  value={fmt(merchPayouts)} />
          <StatCard label="Combined Total"       value={fmt(combined)} />
        </div>

        <div className="rh-section">
          <div className="rh-section-title">Lottery</div>
          <div className="rh-totals-row">
            <div className="rh-total-item">
              <span className="rh-total-label">Lottery Sales</span>
              <span className="rh-total-value">{fmt(lottery.sales)}</span>
            </div>
            <div className="rh-total-item">
              <span className="rh-total-label">Lottery Payouts</span>
              <span className="rh-total-value">{fmt(lottery.payouts)}</span>
            </div>
            <div className="rh-total-item">
              <span className="rh-total-label">Lottery Net</span>
              <span className="rh-total-value">{fmt(lottery.net)}</span>
            </div>
          </div>
        </div>

        <div className="rh-export-row">
          <button className="p-btn p-btn-ghost p-btn-sm" onClick={() => downloadCSV(
            [{ item: 'Expense Payouts', amount: expensePayouts }, { item: 'Merchandise Payouts', amount: merchPayouts },
             { item: 'Lottery Sales', amount: lottery.sales }, { item: 'Lottery Payouts', amount: lottery.payouts }, { item: 'Lottery Net', amount: lottery.net }],
            [{ key: 'item', label: 'Item' }, { key: 'amount', label: 'Amount' }],
            'expenses-report'
          )}>
            <Download size={14} /> CSV
          </button>
          <button className="p-btn p-btn-ghost p-btn-sm" onClick={() => downloadPDF({
            title: 'Expenses Report', subtitle: `${from} to ${to}`,
            summary: [
              { label: 'Expense Payouts', value: fmt(expensePayouts) },
              { label: 'Merch Payouts',   value: fmt(merchPayouts) },
              { label: 'Combined',        value: fmt(combined) },
            ],
            data: [
              { item: 'Expense Payouts', amount: fmt(expensePayouts) },
              { item: 'Merchandise Payouts', amount: fmt(merchPayouts) },
              { item: 'Lottery Sales', amount: fmt(lottery.sales) },
              { item: 'Lottery Payouts', amount: fmt(lottery.payouts) },
              { item: 'Lottery Net', amount: fmt(lottery.net) },
            ],
            columns: [{ key: 'item', label: 'Item' }, { key: 'amount', label: 'Amount' }],
            filename: 'expenses-report',
          })}>
            <FileText size={14} /> PDF
          </button>
        </div>
      </>
    );
  };

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="p-page">
      {/* Header */}
      <div className="p-header">
        <div className="p-header-left">
          <div className="p-header-icon"><BarChart2 size={22} /></div>
          <div>
            <h1 className="p-title">Reports</h1>
            <p className="p-subtitle">Comprehensive store reports and analytics</p>
          </div>
        </div>
      </div>

      {/* Shared Date Controls */}
      {tab !== 'Compare' && tab !== 'Inventory' && (
        <div className="rh-controls">
          <div className="p-field">
            <label className="p-field-label">From</label>
            <input type="date" className="p-input" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="p-field">
            <label className="p-field-label">To</label>
            <input type="date" className="p-input" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <button className="p-btn p-btn-primary p-btn-sm" onClick={handleRun} disabled={loading}>
            {loading ? <><Loader size={14} className="p-spin" /> Running...</> : <><RefreshCw size={14} /> Run</>}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="p-tabs">
        {TABS.map(t => (
          <button
            key={t}
            className={`p-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="p-loading">
          <Loader size={16} className="p-spin" /> Loading report data...
        </div>
      )}

      {/* Tab Content */}
      {!loading && (
        <>
          {tab === 'Summary'   && renderSummary()}
          {tab === 'Tender'    && renderTender()}
          {tab === 'Sales'     && renderSales()}
          {tab === 'Day'       && renderDay()}
          {tab === 'Tax'       && renderTax()}
          {tab === 'Inventory' && renderInventory()}
          {tab === 'Compare'   && renderCompare()}
          {tab === 'Expenses'  && renderExpenses()}
        </>
      )}
    </div>
  );
}
