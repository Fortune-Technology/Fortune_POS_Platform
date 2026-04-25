import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, RefreshCw, ShieldCheck, AlertTriangle, Info, Sparkles, Check,
  User, Building2, Network, Wallet, DollarSign, Zap, TrendingUp, Crown,
} from 'lucide-react';
import MarketingNavbar from '../../components/marketing/MarketingNavbar';
import MarketingFooter from '../../components/marketing/MarketingFooter';
import MarketingButton from '../../components/marketing/MarketingButton';
import SEO from '../../components/SEO';
import {
  CARD_TYPES, CARD_CATEGORIES, PROCESSING_MODELS, NETWORKS,
  calculateBreakdown, projectAnnual, CASH_DISCOUNT_RATE,
} from '../../data/interchangeRates';
import './PaymentSimulator.css';

const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;
const fmt0 = (n) => `$${Math.round(Number(n || 0)).toLocaleString()}`;
const fmtPct = (n) => `${(Number(n || 0) * 100).toFixed(2)}%`;

const STORV_PLANS = PROCESSING_MODELS.filter((m) => m.family === 'storeveu');
const COMPARE_PLANS = PROCESSING_MODELS.filter((m) => m.family === 'compare');

/* 5-station linear pipeline */
const STATIONS = [
  { id: 'customer',  label: 'Customer',     sub: 'Pays for goods',         icon: User,       fee: false },
  { id: 'issuer',    label: 'Issuing Bank', sub: 'Keeps interchange',      icon: Building2,  fee: 'interchange' },
  { id: 'network',   label: 'Card Network', sub: 'Visa / MC / Amex',       icon: Network,    fee: 'assessments' },
  { id: 'storeveu',  label: 'Storeveu',     sub: 'We process for you',     icon: Zap,        fee: 'processorMarkup', isPlatform: true },
  { id: 'merchant',  label: 'Merchant Bank', sub: 'You (final ACH)',       icon: Wallet,     fee: false },
];

const PaymentSimulator = () => {
  const [amount, setAmount] = useState(50);
  const [cardId, setCardId] = useState('visa-cps-retail');
  const [modelId, setModelId] = useState('sv-standard');
  const [cashDiscount, setCashDiscount] = useState(false);
  const [activeCategory, setActiveCategory] = useState('credit');
  const [stage, setStage] = useState(-1);
  const [feesShown, setFeesShown] = useState(new Set());
  const [monthlyTx, setMonthlyTx] = useState(800);
  const animTimerRef = useRef(null);

  const breakdown = useMemo(
    () => calculateBreakdown({ amount, cardId, modelId, cashDiscount }),
    [amount, cardId, modelId, cashDiscount]
  );

  const annual = useMemo(
    () => projectAnnual({ breakdown, monthlyTx }),
    [breakdown, monthlyTx]
  );

  /* All plans compared at the same card+amount+cashDiscount */
  const allPlans = useMemo(
    () => PROCESSING_MODELS
      .map((m) => calculateBreakdown({ amount, cardId, modelId: m.id, cashDiscount }))
      .filter(Boolean),
    [amount, cardId, cashDiscount]
  );

  /* Cheapest plan in dollars (for the merchant) */
  const cheapest = useMemo(() => {
    if (!allPlans.length) return null;
    return allPlans.reduce((min, b) => (b.totalFees < min.totalFees ? b : min), allPlans[0]);
  }, [allPlans]);

  /* Animation — replay on input change */
  const runAnimation = () => {
    if (animTimerRef.current) animTimerRef.current.forEach(clearTimeout);
    setStage(0);
    setFeesShown(new Set());
    const beats = [500, 1100, 1700, 2300, 2900];
    const timers = beats.map((delay, i) => setTimeout(() => {
      setStage(i + 1);
      const station = STATIONS[i + 1];
      if (station?.fee) {
        setFeesShown((prev) => {
          const next = new Set(prev);
          next.add(station.id);
          return next;
        });
      }
    }, delay));
    animTimerRef.current = timers;
  };

  useEffect(() => {
    runAnimation();
    return () => animTimerRef.current?.forEach(clearTimeout);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    runAnimation();
    // eslint-disable-next-line
  }, [amount, cardId, modelId, cashDiscount]);

  if (!breakdown) {
    return <div className="ps-page"><MarketingNavbar /><div className="ps-loading">Loading…</div><MarketingFooter /></div>;
  }

  const stationFeeAmount = (sid) => {
    if (sid === 'issuer')   return breakdown.interchange;
    if (sid === 'network')  return breakdown.assessments;
    if (sid === 'storeveu') return breakdown.processorMarkup;
    return 0;
  };

  const STATION_X = [0, 25, 50, 75, 100];
  const coinX = stage >= 0 ? STATION_X[Math.min(stage, STATIONS.length - 1)] : 0;

  /* Coin running balance (starts at customerCharge — what the card actually processed) */
  const balanceAtStage = (s) => {
    if (s <= 0) return breakdown.customerCharge;
    let bal = breakdown.customerCharge;
    for (let i = 1; i <= s && i < STATIONS.length; i++) {
      const station = STATIONS[i];
      if (station.fee) bal -= stationFeeAmount(station.id);
    }
    return Math.max(bal, 0);
  };

  const cardsInCategory = CARD_TYPES.filter((c) => c.category === activeCategory);

  /* Stacked bar — bar width is normalized to customerCharge so it always fills 100% */
  const total = breakdown.customerCharge;
  const segments = (total > 0 && breakdown.totalFees > 0) ? [
    { label: 'Interchange',     value: breakdown.interchange,     color: '#3d56b5', tooltip: 'Issuing bank' },
    { label: 'Assessments',     value: breakdown.assessments,     color: '#7b95e0', tooltip: 'Card network' },
    { label: 'Storeveu / Processor', value: breakdown.processorMarkup, color: '#a78bfa', tooltip: 'Acquirer / processor' },
    { label: 'Merchant Net',    value: breakdown.merchantNet,     color: '#16a34a', tooltip: 'You — what lands in your bank' },
  ] : [
    { label: 'Merchant Net',    value: breakdown.merchantNet,     color: '#16a34a', tooltip: 'Full amount, free of charge' },
  ];

  const isStorvPlan = breakdown.model.family === 'storeveu';
  const isCheaperThanList = breakdown.netVsListPrice >= -0.005;

  return (
    <div className="ps-page">
      <SEO
        title="Payment Fee Simulator — How Much You Really Pay"
        description="See exactly where every cent of your sale goes. Compare Storeveu's interchange-plus plans against Square and Stripe, and try cash-discount mode."
        url="https://storeveu.com/payment-simulator"
      />
      <MarketingNavbar />

      {/* ─── HERO ───────────────────────────────────────────────── */}
      <section className="ps-hero">
        <div className="mkt-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="ps-hero-content"
          >
            <span className="ps-tag"><Sparkles size={14} /> Interactive simulator</span>
            <h1>
              See exactly where{' '}
              <span className="text-gradient">every cent</span>{' '}
              of your sale goes.
            </h1>
            <p>
              Type an amount, pick the card, choose your Storeveu plan — and watch
              the dollar travel from the customer's wallet to your bank account
              with every fee shaved off in real time.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ─── CONTROLS ────────────────────────────────────────────── */}
      <section className="ps-controls-section">
        <div className="mkt-container">
          {/* Amount + cash discount */}
          <div className="ps-controls">
            <div className="ps-control ps-control-amount">
              <label className="ps-control-label">Sale amount</label>
              <div className="ps-amount-input-wrap">
                <span className="ps-amount-prefix">$</span>
                <input
                  type="number"
                  className="ps-amount-input"
                  value={amount}
                  step="0.01"
                  min="0.01"
                  max="10000"
                  onChange={(e) => setAmount(Math.max(0.01, Number(e.target.value) || 0))}
                />
              </div>
              <input
                type="range"
                className="ps-amount-slider"
                min="1"
                max="500"
                step="1"
                value={Math.min(amount, 500)}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
              <div className="ps-quick-amounts">
                {[5, 25, 50, 100, 250].map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={`ps-quick-amount ${amount === a ? 'ps-quick-amount--active' : ''}`}
                    onClick={() => setAmount(a)}
                  >
                    ${a}
                  </button>
                ))}
              </div>
            </div>

            <div className="ps-control ps-control-cd">
              <label className="ps-control-label">Cash Discount Mode</label>
              <button
                type="button"
                className={`ps-cd-toggle ${cashDiscount ? 'ps-cd-toggle--on' : ''}`}
                onClick={() => setCashDiscount(!cashDiscount)}
              >
                <span className="ps-cd-knob" />
                <span className="ps-cd-state">{cashDiscount ? 'ON' : 'OFF'}</span>
              </button>
              <p className="ps-cd-desc">
                Pass a <strong>{(CASH_DISCOUNT_RATE * 100).toFixed(0)}% surcharge</strong>{' '}
                to customers paying by card. Your <strong>list price stays {fmt(amount)}</strong>;
                card customers pay {fmt(amount * (1 + CASH_DISCOUNT_RATE))}.
                Result: card fees are absorbed by the surcharge, you pocket the full sale.
              </p>
              {cashDiscount && (
                <div className="ps-cd-active">
                  <Check size={14} /> Active — customer charged {fmt(breakdown.customerCharge)}
                </div>
              )}
            </div>
          </div>

          {/* Plan picker — Storeveu tiers prominent + competitor strip */}
          <div className="ps-plan-section">
            <label className="ps-control-label">Choose your plan</label>
            <div className="ps-plans-grid">
              {STORV_PLANS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`ps-plan ps-plan--${m.tier} ${modelId === m.id ? 'ps-plan--active' : ''} ${m.recommended ? 'ps-plan--recommended' : ''}`}
                  onClick={() => setModelId(m.id)}
                  style={{ '--plan-accent': m.color }}
                >
                  {m.recommended && <span className="ps-plan-tag"><Crown size={11} /> Most Popular</span>}
                  <div className="ps-plan-tier">{m.tier}</div>
                  <div className="ps-plan-name">{m.name}</div>
                  <div className="ps-plan-rate">{m.sublabel}</div>
                  <div className="ps-plan-desc">{m.description}</div>
                  <div className="ps-plan-features">
                    <div><Check size={13} /> Interchange-plus pricing</div>
                    <div><Check size={13} /> No hidden fees</div>
                    <div><Check size={13} /> No monthly minimums</div>
                    <div><Check size={13} /> EBT, fuel, fleet supported</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="ps-compare-strip">
              <span className="ps-compare-strip-label">Or compare against industry flat-rate:</span>
              {COMPARE_PLANS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`ps-compare-pill ${modelId === m.id ? 'ps-compare-pill--active' : ''}`}
                  onClick={() => setModelId(m.id)}
                >
                  {m.name} — {m.sublabel}
                </button>
              ))}
            </div>
          </div>

          {/* Card picker */}
          <div className="ps-card-picker">
            <label className="ps-control-label">Customer's card</label>
            <div className="ps-cat-tabs">
              {CARD_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`ps-cat-tab ${activeCategory === cat.id ? 'ps-cat-tab--active' : ''}`}
                  onClick={() => setActiveCategory(cat.id)}
                  title={cat.description}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            <div className="ps-card-grid">
              {cardsInCategory.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`ps-card-tile ${cardId === c.id ? 'ps-card-tile--active' : ''}`}
                  onClick={() => setCardId(c.id)}
                  style={{ '--card-color': NETWORKS[c.network].color }}
                >
                  <div className="ps-card-tile-network">{NETWORKS[c.network].name}</div>
                  <div className="ps-card-tile-name">{c.name}</div>
                  <div className="ps-card-tile-sub">{c.sublabel}</div>
                  <div className="ps-card-tile-rate">
                    {(c.interchange.percent * 100).toFixed(2)}% + ${c.interchange.fixed.toFixed(2)}
                  </div>
                  {c.badge && (
                    <span className={`ps-card-badge ps-card-badge--${c.badge.tone}`}>{c.badge.text}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── PIPELINE ────────────────────────────────────────────── */}
      <section className="ps-pipeline-section">
        <div className="mkt-container">
          <div className="ps-pipeline-header">
            <div>
              <h2>Follow the dollar</h2>
              <p>
                {breakdown.card.name} · {breakdown.model.name}
                {cashDiscount ? <> · cash-discount on (charged {fmt(breakdown.customerCharge)})</> : null}
                {' · '}{fmt(amount)} sale
              </p>
            </div>
            <button type="button" className="ps-replay-btn" onClick={runAnimation}>
              <RefreshCw size={16} /> Replay
            </button>
          </div>

          <div className="ps-pipeline">
            <div className="ps-pipeline-track" />

            {/* Coin */}
            <motion.div
              className="ps-coin"
              animate={{
                left: `${coinX}%`,
                scale: stage === STATIONS.length - 1 ? 1.15 : 1,
              }}
              transition={{ duration: 0.55, ease: [0.45, 0.05, 0.55, 0.95] }}
            >
              <div className="ps-coin-inner">
                <DollarSign size={14} />
                <span>{fmt(balanceAtStage(stage))}</span>
              </div>
            </motion.div>

            <div className="ps-stations">
              {STATIONS.map((station, i) => {
                const Icon = station.icon;
                const reached = stage >= i;
                const fee = station.fee ? stationFeeAmount(station.id) : 0;
                const showFeeChip = feesShown.has(station.id);
                return (
                  <div
                    key={station.id}
                    className={[
                      'ps-station',
                      reached && 'ps-station--reached',
                      station.id === 'merchant' && 'ps-station--merchant',
                      station.isPlatform && 'ps-station--platform',
                    ].filter(Boolean).join(' ')}
                  >
                    <div className="ps-station-icon">
                      <Icon size={22} />
                    </div>
                    <div className="ps-station-label">{station.label}</div>
                    <div className="ps-station-sub">{station.sub}</div>
                    {station.id === 'merchant' && reached && (
                      <motion.div
                        className="ps-station-net"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                      >
                        + {fmt(breakdown.merchantNet)}
                      </motion.div>
                    )}
                    <AnimatePresence>
                      {showFeeChip && fee > 0 && (
                        <motion.div
                          className={`ps-fee-chip ${station.isPlatform ? 'ps-fee-chip--platform' : ''}`}
                          initial={{ opacity: 0, y: -10, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                        >
                          {station.isPlatform ? '+' : '−'} {fmt(fee)}
                          <span className="ps-fee-chip-label">
                            {station.id === 'issuer'   && 'Interchange'}
                            {station.id === 'network'  && 'Assessments'}
                            {station.id === 'storeveu' && (isStorvPlan ? 'Storeveu earns' : 'Processor markup')}
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cash discount banner — when on, highlight the win */}
          {cashDiscount && !breakdown.ebt && (
            <motion.div
              className={`ps-cd-banner ${isCheaperThanList ? 'ps-cd-banner--win' : 'ps-cd-banner--break'}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <TrendingUp size={20} />
              <div>
                <strong>
                  {isCheaperThanList
                    ? `You net ${fmt(breakdown.merchantNet)} on a ${fmt(amount)} sale — surcharge covers all fees, you keep ${fmt(Math.abs(breakdown.netVsListPrice))} extra.`
                    : `Customer's surcharge doesn't fully cover fees on this card — you're ${fmt(Math.abs(breakdown.netVsListPrice))} short of list price.`}
                </strong>
                <br />
                <span className="ps-cd-banner-detail">
                  Customer charged {fmt(breakdown.customerCharge)} (sale {fmt(amount)} + {fmt(breakdown.cdSurcharge)} surcharge) ·
                  Total fees {fmt(breakdown.totalFees)} ·
                  Net to merchant {fmt(breakdown.merchantNet)}
                </span>
              </div>
            </motion.div>
          )}

          {breakdown.ebt && (
            <motion.div className="ps-ebt-banner" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <ShieldCheck size={20} />
              <div>
                <strong>EBT SNAP is free by federal law.</strong>{' '}
                The USDA Farm Bill prohibits charging merchants any fees on SNAP transactions. Your full {fmt(amount)} lands in your account.
              </div>
            </motion.div>
          )}

          {breakdown.warning && (
            <div className="ps-warn-banner">
              <AlertTriangle size={18} />
              <span>{breakdown.warning}</span>
            </div>
          )}

          {breakdown.card.funFact && (
            <motion.div
              className="ps-funfact"
              key={breakdown.card.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
            >
              <Info size={16} />
              <p><strong>Did you know?</strong> {breakdown.card.funFact}</p>
            </motion.div>
          )}
        </div>
      </section>

      {/* ─── BREAKDOWN + PLATFORM REVENUE ─────────────────────────── */}
      <section className="ps-breakdown-section">
        <div className="mkt-container">
          <div className="ps-breakdown-grid">
            {/* Stacked bar */}
            <div className="ps-breakdown-card">
              <h3>Where the {fmt(breakdown.customerCharge)} {cashDiscount && breakdown.cdSurcharge > 0 ? '(card-charge)' : ''} goes</h3>
              <div className="ps-bar">
                {segments.map((seg, i) => {
                  const pct = (seg.value / total) * 100;
                  if (pct < 0.01) return null;
                  return (
                    <div
                      key={i}
                      className="ps-bar-seg"
                      style={{ width: `${pct}%`, background: seg.color }}
                      title={`${seg.label}: ${fmt(seg.value)} (${pct.toFixed(1)}%)`}
                    >
                      {pct > 8 && (
                        <span className="ps-bar-seg-label">
                          {seg.label}<br />
                          <strong>{fmt(seg.value)}</strong>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="ps-bar-legend">
                {segments.map((seg, i) => (
                  <div key={i} className="ps-bar-legend-item">
                    <span className="ps-bar-legend-dot" style={{ background: seg.color }} />
                    <span className="ps-bar-legend-label">{seg.label}</span>
                    <span className="ps-bar-legend-value">{fmt(seg.value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stat stack */}
            <div className="ps-stat-stack">
              <div className="ps-stat-card ps-stat-card--primary">
                <div className="ps-stat-label">You receive</div>
                <div className="ps-stat-value">{fmt(breakdown.merchantNet)}</div>
                <div className="ps-stat-sub">
                  {cashDiscount && Math.abs(breakdown.netVsListPrice) > 0.005
                    ? (breakdown.netVsListPrice > 0
                        ? `+${fmt(breakdown.netVsListPrice)} above list price`
                        : `${fmt(breakdown.netVsListPrice)} below list`)
                    : `of ${fmt(amount)} list price`}
                </div>
              </div>
              <div className="ps-stat-card">
                <div className="ps-stat-label">Effective rate</div>
                <div className="ps-stat-value">{fmtPct(breakdown.effectiveRate)}</div>
                <div className="ps-stat-sub">all-in cost on this sale</div>
              </div>
              {isStorvPlan ? (
                <div className="ps-stat-card ps-stat-card--storv">
                  <div className="ps-stat-label">Storeveu earns</div>
                  <div className="ps-stat-value">{fmt(breakdown.platformRevenue)}</div>
                  <div className="ps-stat-sub">our markup on this transaction</div>
                </div>
              ) : (
                <div className="ps-stat-card">
                  <div className="ps-stat-label">Total fees</div>
                  <div className="ps-stat-value ps-stat-value--neg">−{fmt(breakdown.totalFees)}</div>
                  <div className="ps-stat-sub">across all parties</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── COMPLETE ECOSYSTEM CYCLE (educational) ────────────── */}
      <section className="ps-cycle-section">
        <div className="mkt-container">
          <div className="ps-cycle-header">
            <h2>The complete payment cycle</h2>
            <p>
              The full picture — including how the cardholder eventually settles their statement.
              Each fee is set by a different authority, which is why some are negotiable and others aren't.
            </p>
          </div>

          <div className="ps-cycle-frame">
            <svg viewBox="0 0 800 540" className="ps-cycle-svg" preserveAspectRatio="xMidYMid meet">
              {/* Connection arrows */}
              <defs>
                <marker id="psArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                  <path d="M0,0 L10,5 L0,10 Z" fill="#3d56b5" />
                </marker>
              </defs>

              {/* 1. Cardholder → Merchant */}
              <line x1="180" y1="120" x2="620" y2="120" stroke="#3d56b5" strokeWidth="2" strokeDasharray="6 4" markerEnd="url(#psArrow)" />
              {/* 2. Merchant → Acquirer (down right) */}
              <line x1="700" y1="170" x2="700" y2="380" stroke="#3d56b5" strokeWidth="2" strokeDasharray="6 4" markerEnd="url(#psArrow)" />
              {/* 3. Acquirer → Network (diagonal up-left) */}
              <line x1="640" y1="410" x2="460" y2="290" stroke="#3d56b5" strokeWidth="2" strokeDasharray="6 4" markerEnd="url(#psArrow)" />
              {/* 4. Network → Issuer (diagonal down-left) */}
              <line x1="340" y1="290" x2="160" y2="410" stroke="#3d56b5" strokeWidth="2" strokeDasharray="6 4" markerEnd="url(#psArrow)" />
              {/* 5. Issuer → Cardholder (up left, billing statement) */}
              <line x1="100" y1="380" x2="100" y2="170" stroke="#7b95e0" strokeWidth="2" strokeDasharray="3 4" markerEnd="url(#psArrow)" />
            </svg>

            {/* Cardholder */}
            <div className="ps-cy-actor ps-cy-actor--cardholder">
              <div className="ps-cy-icon"><User size={26} /></div>
              <div className="ps-cy-label">Cardholder</div>
              <div className="ps-cy-sub">Customer with the card</div>
            </div>

            {/* Merchant */}
            <div className="ps-cy-actor ps-cy-actor--merchant">
              <div className="ps-cy-icon"><Wallet size={26} /></div>
              <div className="ps-cy-label">Merchant</div>
              <div className="ps-cy-sub">You — the store</div>
            </div>

            {/* Card Network (center) */}
            <div className="ps-cy-actor ps-cy-actor--network">
              <div className="ps-cy-icon ps-cy-icon--center"><Network size={28} /></div>
              <div className="ps-cy-label">Card Network</div>
              <div className="ps-cy-sub">Visa · Mastercard · Amex · Discover</div>
              <div className="ps-cy-tagline">The rails between issuer and acquirer</div>
            </div>

            {/* Issuing Bank */}
            <div className="ps-cy-actor ps-cy-actor--issuer">
              <div className="ps-cy-icon"><Building2 size={26} /></div>
              <div className="ps-cy-label">Issuing Bank</div>
              <div className="ps-cy-sub">Issued the card to customer</div>
            </div>

            {/* Acquirer (Storeveu) */}
            <div className="ps-cy-actor ps-cy-actor--acquirer">
              <div className="ps-cy-icon ps-cy-icon--storv"><Zap size={26} /></div>
              <div className="ps-cy-label">Storeveu (Acquirer)</div>
              <div className="ps-cy-sub">Your payment platform</div>
            </div>

            {/* Money labels on each leg */}
            <div className="ps-cy-leg ps-cy-leg--purchase">
              <div className="ps-cy-leg-step">1</div>
              <div className="ps-cy-leg-title">Purchase price</div>
              <div className="ps-cy-leg-amt">{fmt(breakdown.customerCharge)}</div>
              <div className="ps-cy-leg-set ps-cy-leg-set--merchant">Set by Merchant</div>
            </div>

            <div className="ps-cy-leg ps-cy-leg--mdf">
              <div className="ps-cy-leg-step">2</div>
              <div className="ps-cy-leg-title">Merchant Discount Fee</div>
              <div className="ps-cy-leg-amt">−{fmt(breakdown.totalFees)}</div>
              <div className="ps-cy-leg-set ps-cy-leg-set--acquirer">Set by Acquirer</div>
            </div>

            <div className="ps-cy-leg ps-cy-leg--markup">
              <div className="ps-cy-leg-step">3</div>
              <div className="ps-cy-leg-title">Acquirer markup</div>
              <div className="ps-cy-leg-amt">{fmt(breakdown.processorMarkup)}</div>
              <div className="ps-cy-leg-set ps-cy-leg-set--acquirer">{isStorvPlan ? 'Storeveu' : breakdown.model.name}</div>
            </div>

            <div className="ps-cy-leg ps-cy-leg--interchange">
              <div className="ps-cy-leg-step">4</div>
              <div className="ps-cy-leg-title">Interchange fee</div>
              <div className="ps-cy-leg-amt">{fmt(breakdown.interchange)}</div>
              <div className="ps-cy-leg-set ps-cy-leg-set--network">Set by Card Network</div>
            </div>

            <div className="ps-cy-leg ps-cy-leg--assess">
              <div className="ps-cy-leg-step">5</div>
              <div className="ps-cy-leg-title">Network assessments</div>
              <div className="ps-cy-leg-amt">{fmt(breakdown.assessments)}</div>
              <div className="ps-cy-leg-set ps-cy-leg-set--network">Set by Card Network</div>
            </div>

            <div className="ps-cy-leg ps-cy-leg--bill">
              <div className="ps-cy-leg-step">6</div>
              <div className="ps-cy-leg-title">Statement billed</div>
              <div className="ps-cy-leg-amt">{fmt(breakdown.customerCharge)}</div>
              <div className="ps-cy-leg-set ps-cy-leg-set--issuer">Set by Issuer (interest, fees)</div>
            </div>
          </div>

          <div className="ps-cycle-formula">
            <strong>Merchant Discount Fee = Interchange + Network Assessments + Acquirer Markup</strong><br />
            <span>{fmt(breakdown.totalFees)} = {fmt(breakdown.interchange)} + {fmt(breakdown.assessments)} + {fmt(breakdown.processorMarkup)}</span>
          </div>
        </div>
      </section>

      {/* ─── PLAN COMPARISON ─────────────────────────────────────── */}
      <section className="ps-compare-section">
        <div className="mkt-container">
          <h2>All plans, side by side</h2>
          <p className="ps-compare-sub">
            Same {fmt(amount)} sale on a <strong>{breakdown.card.name}</strong>
            {cashDiscount && <> with cash-discount on (customer charged {fmt(amount * (1 + CASH_DISCOUNT_RATE))})</>}.
            Cheapest for the merchant is highlighted.
          </p>
          <div className="ps-compare-grid">
            {allPlans.map((b) => {
              const isCheapest = cheapest && b.model.id === cheapest.model.id;
              const isCurrent  = b.model.id === modelId;
              const delta = cheapest ? b.totalFees - cheapest.totalFees : 0;
              const isStorv = b.model.family === 'storeveu';
              return (
                <button
                  key={b.model.id}
                  type="button"
                  className={[
                    'ps-compare-card',
                    isStorv && 'ps-compare-card--storv',
                    isCheapest && 'ps-compare-card--best',
                    isCurrent && 'ps-compare-card--current',
                  ].filter(Boolean).join(' ')}
                  onClick={() => setModelId(b.model.id)}
                >
                  {isCheapest && <span className="ps-compare-tag ps-compare-tag--best">Cheapest</span>}
                  {isCurrent && !isCheapest && <span className="ps-compare-tag">Selected</span>}
                  <div className="ps-compare-name">{b.model.name}</div>
                  <div className="ps-compare-sub-line">{b.model.sublabel}</div>
                  <div className="ps-compare-net">{fmt(b.merchantNet)}</div>
                  <div className="ps-compare-net-label">you receive</div>
                  <div className="ps-compare-fee">
                    Fee: <strong>{fmt(b.totalFees)}</strong> ({fmtPct(b.effectiveRate)})
                  </div>
                  {!isCheapest && delta > 0.005 && (
                    <div className="ps-compare-delta">+{fmt(delta)} more than cheapest</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── ANNUAL: MERCHANT COST + PLATFORM REVENUE ───────────── */}
      <section className="ps-annual-section">
        <div className="mkt-container">
          <div className="ps-annual-card">
            <h2>Scale this up — what does a year look like?</h2>
            <p>
              At <strong>{monthlyTx.toLocaleString()}</strong> transactions/month
              and <strong>{fmt(amount)}</strong> average ticket
              {cashDiscount && <>, with cash-discount on</>}.
            </p>
            <input
              type="range"
              className="ps-annual-slider"
              min="50"
              max="10000"
              step="50"
              value={monthlyTx}
              onChange={(e) => setMonthlyTx(Number(e.target.value))}
            />
            <div className="ps-annual-slider-labels">
              <span>50 / mo</span>
              <span>10,000 / mo</span>
            </div>

            {annual && (
              <div className="ps-annual-grid">
                {allPlans.map((b) => {
                  const proj = projectAnnual({ breakdown: b, monthlyTx });
                  const isCheapest = cheapest && b.model.id === cheapest.model.id;
                  const cheapestProj = cheapest ? projectAnnual({ breakdown: cheapest, monthlyTx }) : null;
                  const annualDelta = cheapestProj ? proj.yearlyTotal - cheapestProj.yearlyTotal : 0;
                  const isStorv = b.model.family === 'storeveu';
                  return (
                    <div
                      key={b.model.id}
                      className={[
                        'ps-annual-row',
                        isCheapest && 'ps-annual-row--best',
                        isStorv && 'ps-annual-row--storv',
                      ].filter(Boolean).join(' ')}
                    >
                      <div className="ps-annual-row-name">
                        {b.model.name}
                        {isStorv && <span className="ps-annual-row-tag-inline">Storeveu</span>}
                      </div>
                      <div className="ps-annual-row-detail">
                        Per-tx fee: {fmt(b.totalFees)}
                        {isStorv && <> · we earn {fmt(b.platformRevenue)}/tx</>}
                      </div>
                      <div className="ps-annual-row-total">
                        {fmt0(proj.yearlyTotal)}<span> / year</span>
                      </div>
                      <div className="ps-annual-row-trail">
                        {isCheapest ? (
                          <span className="ps-annual-pill ps-annual-pill--best">Best</span>
                        ) : (
                          <span className="ps-annual-pill ps-annual-pill--more">+{fmt0(annualDelta)} more</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Storeveu platform revenue at this volume */}
            {isStorvPlan && annual && (
              <div className="ps-platform-rev">
                <div className="ps-platform-rev-icon"><Sparkles size={24} /></div>
                <div className="ps-platform-rev-body">
                  <div className="ps-platform-rev-label">Storeveu's annual revenue from your store on {breakdown.model.name}</div>
                  <div className="ps-platform-rev-value">{fmt0(annual.yearlyPlatformRevenue)}</div>
                  <div className="ps-platform-rev-sub">
                    {fmt(breakdown.platformRevenue)}/tx × {(monthlyTx * 12).toLocaleString()} tx/year — transparent, predictable, no hidden costs to you.
                  </div>
                </div>
              </div>
            )}

            <div className="ps-annual-footnote">
              <Info size={14} />
              <span>
                Projection covers transaction-level fees only. Real-world statements include monthly statement,
                gateway, PCI, and chargeback fees that vary by provider. Storeveu plans bundle these in — no surprise add-ons.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── EDUCATIONAL FOOTER ────────────────────────────────── */}
      <section className="ps-foot-section">
        <div className="mkt-container">
          <div className="ps-foot-grid">
            <div className="ps-foot-card">
              <h4>What's fixed by authority</h4>
              <ul>
                <li><strong>Regulated debit interchange</strong> — capped by US Federal Reserve Reg II (Durbin Amendment)</li>
                <li><strong>Other interchange</strong> — set by Visa / Mastercard / Amex / Discover (not negotiable)</li>
                <li><strong>Network assessments</strong> — set by the network</li>
                <li><strong>EBT SNAP fees</strong> — prohibited by USDA Farm Bill</li>
              </ul>
            </div>
            <div className="ps-foot-card">
              <h4>What you can negotiate</h4>
              <ul>
                <li><strong>Acquirer markup</strong> — Storeveu's plans are interchange-plus and transparent</li>
                <li><strong>Pricing model</strong> — interchange-plus (transparent) vs flat-rate (opaque)</li>
                <li><strong>Cash discount</strong> — pass card fees to card-paying customers, net the full sale</li>
                <li><strong>Monthly fees</strong> — Storeveu has zero monthly minimums on every plan</li>
              </ul>
            </div>
          </div>
          <div className="ps-foot-tiny">
            Rates current as of April 2025 — Visa and Mastercard publish updates April + October each year.
            This simulator is for educational purposes; verify against your actual processor statement before making decisions.
          </div>
        </div>
      </section>

      {/* ─── CTA ────────────────────────────────────────────────── */}
      <section className="ps-cta-section">
        <div className="mkt-container">
          <div className="ps-cta-card">
            <h2>Ready to see your real numbers?</h2>
            <p>
              Send us your last processor statement. We'll annotate every line, show you exactly
              what you're paying — and put you on the Storeveu plan that saves you the most.
            </p>
            <MarketingButton href="/contact" size="lg" icon={ArrowRight}>Get a free statement audit</MarketingButton>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
};

export default PaymentSimulator;
