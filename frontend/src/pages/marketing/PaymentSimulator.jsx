import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Play, RefreshCw, ShieldCheck, AlertTriangle, Info,
  User, Building2, Network, Cpu, Wallet, CreditCard, DollarSign, Sparkles,
} from 'lucide-react';
import MarketingNavbar from '../../components/marketing/MarketingNavbar';
import MarketingFooter from '../../components/marketing/MarketingFooter';
import MarketingButton from '../../components/marketing/MarketingButton';
import SEO from '../../components/SEO';
import {
  CARD_TYPES, CARD_CATEGORIES, PROCESSING_MODELS, NETWORKS,
  calculateBreakdown, projectAnnual,
} from '../../data/interchangeRates';
import './PaymentSimulator.css';

const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;
const fmt0 = (n) => `$${Math.round(Number(n || 0)).toLocaleString()}`;
const fmtPct = (n) => `${(Number(n || 0) * 100).toFixed(2)}%`;

/* ── 5-station pipeline used for the animation ── */
const STATIONS = [
  { id: 'customer',  label: 'Customer',          sub: 'Pays for goods',          icon: User,       fee: false },
  { id: 'issuer',    label: 'Issuing Bank',      sub: 'Keeps interchange',       icon: Building2,  fee: 'interchange' },
  { id: 'network',   label: 'Card Network',      sub: 'Visa / MC / Amex / Disc', icon: Network,    fee: 'assessments' },
  { id: 'processor', label: 'Processor',         sub: 'Acquirer markup',         icon: Cpu,        fee: 'processorMarkup' },
  { id: 'merchant',  label: 'Merchant Bank',     sub: 'You (final ACH)',         icon: Wallet,     fee: false },
];

const PaymentSimulator = () => {
  const [amount, setAmount] = useState(50);
  const [cardId, setCardId] = useState('visa-cps-retail');
  const [modelId, setModelId] = useState('ic-plus');
  const [activeCategory, setActiveCategory] = useState('credit');
  const [stage, setStage] = useState(-1);
  const [feesShown, setFeesShown] = useState(new Set());
  const [monthlyTx, setMonthlyTx] = useState(800);
  const animTimerRef = useRef(null);

  const breakdown = useMemo(
    () => calculateBreakdown({ amount, cardId, modelId }),
    [amount, cardId, modelId]
  );

  const annual = useMemo(
    () => projectAnnual({ breakdown, monthlyTx }),
    [breakdown, monthlyTx]
  );

  /* All pricing models compared for the same card+amount */
  const allModels = useMemo(
    () => PROCESSING_MODELS.map((m) => calculateBreakdown({ amount, cardId, modelId: m.id })).filter(Boolean),
    [amount, cardId]
  );

  /* Cheapest model for this card+amount, used to show savings */
  const cheapest = useMemo(() => {
    if (!allModels.length) return null;
    return allModels.reduce((min, b) => (b.totalFees < min.totalFees ? b : min), allModels[0]);
  }, [allModels]);

  /* ── Animation runner ─────────────────────────────────────────────── */
  const runAnimation = () => {
    if (animTimerRef.current) {
      animTimerRef.current.forEach(clearTimeout);
    }
    setStage(0);
    setFeesShown(new Set());
    const beats = [500, 1100, 1700, 2300, 2900];
    const timers = [];
    beats.forEach((delay, i) => {
      timers.push(setTimeout(() => {
        setStage(i + 1);
        // reveal fee chip when coin reaches a fee station
        const station = STATIONS[i + 1];
        if (station?.fee) {
          setFeesShown((prev) => {
            const next = new Set(prev);
            next.add(station.id);
            return next;
          });
        }
      }, delay));
    });
    animTimerRef.current = timers;
  };

  /* Auto-run on mount */
  useEffect(() => {
    runAnimation();
    return () => {
      if (animTimerRef.current) animTimerRef.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line
  }, []);

  /* Re-run when inputs change */
  useEffect(() => {
    runAnimation();
    // eslint-disable-next-line
  }, [amount, cardId, modelId]);

  if (!breakdown) {
    return (
      <div className="ps-page">
        <MarketingNavbar />
        <div className="mkt-container ps-loading">Loading…</div>
        <MarketingFooter />
      </div>
    );
  }

  const stationFeeAmount = (stationId) => {
    if (stationId === 'issuer') return breakdown.interchange;
    if (stationId === 'network') return breakdown.assessments;
    if (stationId === 'processor') return breakdown.processorMarkup;
    return 0;
  };

  /* Rolling balance shown on the traveling coin at each station */
  const balanceAtStage = (s) => {
    if (s <= 0) return amount;
    let bal = amount;
    for (let i = 1; i <= s && i < STATIONS.length; i++) {
      const station = STATIONS[i];
      if (station.fee) bal -= stationFeeAmount(station.id);
    }
    return Math.max(bal, 0);
  };

  /* % of pipeline width per station for the coin */
  const STATION_X = [0, 25, 50, 75, 100];
  const coinX = stage >= 0 ? STATION_X[Math.min(stage, STATIONS.length - 1)] : 0;

  /* Filter cards by category */
  const cardsInCategory = CARD_TYPES.filter((c) => c.category === activeCategory);

  /* Total fee bar segments (proportional to amount) */
  const segments = breakdown.totalFees > 0 ? [
    { label: 'Interchange',  value: breakdown.interchange,     color: '#3d56b5', tooltip: 'Issuing bank' },
    { label: 'Assessments',  value: breakdown.assessments,     color: '#7b95e0', tooltip: 'Card network' },
    { label: 'Processor',    value: breakdown.processorMarkup, color: '#a78bfa', tooltip: 'Acquirer / processor' },
    { label: 'Merchant Net', value: breakdown.merchantNet,     color: '#16a34a', tooltip: 'You — what lands in your bank' },
  ] : [
    { label: 'Merchant Net', value: breakdown.merchantNet,     color: '#16a34a', tooltip: 'You — full amount, free of charge' },
  ];

  return (
    <div className="ps-page">
      <SEO
        title="How Payments Work — Interactive Simulator"
        description="See exactly where every cent goes between your customer's card and your bank account. Compare interchange-plus, flat-rate, and membership pricing on real card types."
        url="https://storeveu.com/payment-simulator"
      />
      <MarketingNavbar />

      {/* ─── HERO ─────────────────────────────────────────────────── */}
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
              Type an amount, pick the card the customer used, and watch the dollar
              travel from their wallet to your bank account — with every fee shaved
              off in real time.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ─── CONTROLS ────────────────────────────────────────────── */}
      <section className="ps-controls-section">
        <div className="mkt-container">
          <div className="ps-controls">
            {/* Amount */}
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
                    className={`ps-quick-amount ${amount === a ? 'ps-quick-amount--active' : ''}`}
                    onClick={() => setAmount(a)}
                    type="button"
                  >
                    ${a}
                  </button>
                ))}
              </div>
            </div>

            {/* Pricing model */}
            <div className="ps-control ps-control-model">
              <label className="ps-control-label">Your processing model</label>
              <div className="ps-model-grid">
                {PROCESSING_MODELS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`ps-model-btn ${modelId === m.id ? 'ps-model-btn--active' : ''}`}
                    onClick={() => setModelId(m.id)}
                  >
                    <div className="ps-model-name">{m.name}</div>
                    <div className="ps-model-sub">{m.sublabel}</div>
                    {m.transparent && (
                      <span className="ps-model-badge"><ShieldCheck size={11} /> Transparent</span>
                    )}
                  </button>
                ))}
              </div>
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
                    <span className={`ps-card-badge ps-card-badge--${c.badge.tone}`}>
                      {c.badge.text}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── PIPELINE ──────────────────────────────────────────────── */}
      <section className="ps-pipeline-section">
        <div className="mkt-container">
          <div className="ps-pipeline-header">
            <div>
              <h2>Follow the dollar</h2>
              <p>{breakdown.card.name} · {breakdown.model.name} · {fmt(amount)} sale</p>
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

            {/* Stations */}
            <div className="ps-stations">
              {STATIONS.map((station, i) => {
                const Icon = station.icon;
                const reached = stage >= i;
                const fee = station.fee ? stationFeeAmount(station.id) : 0;
                const showFeeChip = feesShown.has(station.id);
                return (
                  <div
                    key={station.id}
                    className={`ps-station ${reached ? 'ps-station--reached' : ''} ${station.id === 'merchant' ? 'ps-station--merchant' : ''}`}
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
                          className="ps-fee-chip"
                          initial={{ opacity: 0, y: -10, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                        >
                          − {fmt(fee)}
                          <span className="ps-fee-chip-label">
                            {station.id === 'issuer' && 'Interchange'}
                            {station.id === 'network' && 'Assessments'}
                            {station.id === 'processor' && 'Markup'}
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>

          {/* EBT free banner */}
          {breakdown.ebt && (
            <motion.div
              className="ps-ebt-banner"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
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

          {/* Card fun fact */}
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

      {/* ─── BREAKDOWN ──────────────────────────────────────────────── */}
      <section className="ps-breakdown-section">
        <div className="mkt-container">
          <div className="ps-breakdown-grid">
            {/* Stacked bar */}
            <div className="ps-breakdown-card">
              <h3>Where your {fmt(amount)} goes</h3>
              <div className="ps-bar">
                {segments.map((seg, i) => {
                  const pct = (seg.value / amount) * 100;
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

            {/* Stat cards */}
            <div className="ps-stat-stack">
              <div className="ps-stat-card ps-stat-card--primary">
                <div className="ps-stat-label">You receive</div>
                <div className="ps-stat-value">{fmt(breakdown.merchantNet)}</div>
                <div className="ps-stat-sub">of {fmt(amount)} charged</div>
              </div>
              <div className="ps-stat-card">
                <div className="ps-stat-label">Effective rate</div>
                <div className="ps-stat-value">{fmtPct(breakdown.effectiveRate)}</div>
                <div className="ps-stat-sub">all-in cost on this sale</div>
              </div>
              <div className="ps-stat-card">
                <div className="ps-stat-label">Total fees</div>
                <div className="ps-stat-value ps-stat-value--neg">−{fmt(breakdown.totalFees)}</div>
                <div className="ps-stat-sub">across all parties</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── COMPARE PRICING MODELS ─────────────────────────────────── */}
      <section className="ps-compare-section">
        <div className="mkt-container">
          <h2>Same card, four pricing models</h2>
          <p className="ps-compare-sub">
            Same {fmt(amount)} sale on a <strong>{breakdown.card.name}</strong>, run through every pricing model. The cheapest one is highlighted.
          </p>
          <div className="ps-compare-grid">
            {allModels.map((b) => {
              const isCheapest = cheapest && b.model.id === cheapest.model.id;
              const isCurrent = b.model.id === modelId;
              const delta = cheapest ? b.totalFees - cheapest.totalFees : 0;
              return (
                <button
                  key={b.model.id}
                  type="button"
                  className={`ps-compare-card ${isCheapest ? 'ps-compare-card--best' : ''} ${isCurrent ? 'ps-compare-card--current' : ''}`}
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

      {/* ─── ANNUAL PROJECTION ──────────────────────────────────────── */}
      <section className="ps-annual-section">
        <div className="mkt-container">
          <div className="ps-annual-card">
            <h2>Scale this up — what does a year cost?</h2>
            <p>
              If your store does <strong>{monthlyTx.toLocaleString()}</strong>{' '}
              transactions per month at this average ticket of <strong>{fmt(amount)}</strong>, here's what each pricing model would cost annually.
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
                {allModels.map((b) => {
                  const proj = projectAnnual({ breakdown: b, monthlyTx });
                  const isCheapest = cheapest && b.model.id === cheapest.model.id;
                  const cheapestAnnual = cheapest ? projectAnnual({ breakdown: cheapest, monthlyTx }) : null;
                  const annualDelta = cheapestAnnual ? proj.yearlyTotal - cheapestAnnual.yearlyTotal : 0;
                  return (
                    <div
                      key={b.model.id}
                      className={`ps-annual-row ${isCheapest ? 'ps-annual-row--best' : ''}`}
                    >
                      <div className="ps-annual-row-name">{b.model.name}</div>
                      <div className="ps-annual-row-detail">
                        Per-tx: {fmt(b.totalFees)}
                        {b.model.monthly ? <> · +{fmt(b.model.monthly)}/mo membership</> : null}
                      </div>
                      <div className="ps-annual-row-total">
                        {fmt0(proj.yearlyTotal)}<span> / year</span>
                      </div>
                      {isCheapest ? (
                        <div className="ps-annual-row-tag ps-annual-row-tag--best">Best</div>
                      ) : (
                        <div className="ps-annual-row-tag">+{fmt0(annualDelta)} more</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="ps-annual-footnote">
              <Info size={14} />
              <span>
                Projection covers transaction-level fees only. Monthly statement, gateway, PCI, and chargeback fees are real but vary too widely to model here.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── DISCLAIMER ─────────────────────────────────────────────── */}
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
                <li><strong>Processor markup</strong> — the only competitive layer</li>
                <li><strong>Pricing model</strong> — interchange-plus is dramatically cheaper than flat-rate at scale</li>
                <li><strong>Monthly fees</strong> — gateway, statement, PCI, chargeback</li>
                <li><strong>Contract terms</strong> — early termination, lock-ins</li>
              </ul>
            </div>
          </div>
          <div className="ps-foot-tiny">
            Rates current as of April 2025 — Visa and Mastercard publish updates April + October each year. This simulator is for educational purposes; verify against your processor's actual statement before making decisions.
          </div>
        </div>
      </section>

      {/* ─── CTA ────────────────────────────────────────────────────── */}
      <section className="ps-cta-section">
        <div className="mkt-container">
          <div className="ps-cta-card">
            <h2>Want to see your actual rates?</h2>
            <p>Send us your last processor statement. We'll annotate it line-by-line and tell you exactly what you're paying — and what you could save.</p>
            <MarketingButton href="/contact" size="lg" icon={ArrowRight}>Get a free statement audit</MarketingButton>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
};

export default PaymentSimulator;
