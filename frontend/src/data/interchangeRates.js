/**
 * Interchange + processing fee rates — US, current as of April 2025.
 * Sources: Visa Apr 2025 rate card, Mastercard Apr 2025, Amex OptBlue, Federal Reserve Reg II.
 *
 * Networks publish updates April + October each year. Verify against official rate
 * cards before quoting real merchants.
 */

export const NETWORKS = {
  visa: {
    id: 'visa',
    name: 'Visa',
    color: '#1a1f71',
    assessment: 0.0014,    // 0.14% on credit
    perTx: 0.0195,         // NABU per-transaction
  },
  mastercard: {
    id: 'mastercard',
    name: 'Mastercard',
    color: '#eb001b',
    assessment: 0.001375,
    perTx: 0.0195,
  },
  amex: {
    id: 'amex',
    name: 'American Express',
    color: '#006fcf',
    assessment: 0.0015,
    perTx: 0.0195,
  },
  discover: {
    id: 'discover',
    name: 'Discover',
    color: '#ff6000',
    assessment: 0.00135,
    perTx: 0.0195,
  },
  ebt: {
    id: 'ebt',
    name: 'EBT (USDA)',
    color: '#16a34a',
    assessment: 0,
    perTx: 0,
  },
};

/**
 * Each card type carries the interchange rate the issuer collects.
 * `category` is used for grouping in the picker.
 */
export const CARD_TYPES = [
  // ── DEBIT ────────────────────────────────────────────────────────────
  {
    id: 'visa-debit-regulated',
    category: 'debit',
    name: 'Visa Debit',
    sublabel: 'Regulated · large bank',
    network: 'visa',
    interchange: { percent: 0.0005, fixed: 0.22 },
    badge: { text: 'Capped by federal law', tone: 'green' },
    funFact: 'The Durbin Amendment (Federal Reserve Reg II, 2011) caps debit interchange at $0.21 + 0.05% + $0.01 fraud adjustment for banks holding more than $10B in assets. After EBT, this is the cheapest card a merchant can accept.',
  },
  {
    id: 'visa-debit-unregulated',
    category: 'debit',
    name: 'Visa Debit',
    sublabel: 'Unregulated · small bank',
    network: 'visa',
    interchange: { percent: 0.008, fixed: 0.15 },
    funFact: 'Banks under $10B in assets are exempt from Durbin caps. Same Visa Debit logo on the card, ~3× more expensive at the merchant counter.',
  },
  // ── CREDIT — STANDARD ────────────────────────────────────────────────
  {
    id: 'visa-cps-retail',
    category: 'credit',
    name: 'Visa Classic Credit',
    sublabel: 'CPS/Retail · most common',
    network: 'visa',
    interchange: { percent: 0.0151, fixed: 0.10 },
    badge: { text: 'Most common', tone: 'blue' },
    funFact: 'Visa\'s CPS/Retail tier is the baseline rate for an in-person, AVS-verified, basic-tier consumer credit card at a typical retail MCC.',
  },
  {
    id: 'mc-merit-iii',
    category: 'credit',
    name: 'Mastercard',
    sublabel: 'Merit III · standard credit',
    network: 'mastercard',
    interchange: { percent: 0.0158, fixed: 0.10 },
  },
  {
    id: 'discover',
    category: 'credit',
    name: 'Discover',
    sublabel: 'Standard credit',
    network: 'discover',
    interchange: { percent: 0.0162, fixed: 0.10 },
  },
  // ── CREDIT — REWARDS / PREMIUM ───────────────────────────────────────
  {
    id: 'visa-signature',
    category: 'rewards',
    name: 'Visa Signature',
    sublabel: 'Rewards card',
    network: 'visa',
    interchange: { percent: 0.0210, fixed: 0.10 },
    badge: { text: 'Rewards', tone: 'gold' },
    funFact: 'The points, miles, and cash-back on the customer\'s card come straight out of merchant interchange. Premium rewards cards charge merchants more so issuers can fund rewards.',
  },
  {
    id: 'mc-world-elite',
    category: 'rewards',
    name: 'Mastercard World Elite',
    sublabel: 'Premium rewards',
    network: 'mastercard',
    interchange: { percent: 0.0205, fixed: 0.10 },
    badge: { text: 'Rewards', tone: 'gold' },
  },
  {
    id: 'visa-infinite',
    category: 'rewards',
    name: 'Visa Infinite',
    sublabel: 'Top-tier rewards',
    network: 'visa',
    interchange: { percent: 0.0240, fixed: 0.10 },
    badge: { text: 'Premium', tone: 'gold' },
    funFact: 'Cards like Chase Sapphire Reserve or Visa Infinite charge the highest consumer interchange. A $100 sale on one of these costs you ~50% more in fees than a basic Visa Classic.',
  },
  {
    id: 'amex-standard',
    category: 'rewards',
    name: 'American Express',
    sublabel: 'Standard',
    network: 'amex',
    interchange: { percent: 0.0230, fixed: 0.10 },
    funFact: 'Amex historically operated as both network AND issuer — they kept the entire merchant discount themselves. Most US merchants now pay through "OptBlue", which uses Visa-style interchange-plus pricing through the acquirer.',
  },
  {
    id: 'amex-platinum',
    category: 'rewards',
    name: 'Amex Platinum',
    sublabel: 'Premium',
    network: 'amex',
    interchange: { percent: 0.0265, fixed: 0.10 },
    badge: { text: 'Premium', tone: 'gold' },
  },
  // ── BUSINESS / CORPORATE ─────────────────────────────────────────────
  {
    id: 'visa-business',
    category: 'business',
    name: 'Visa Business',
    sublabel: 'Corporate / Purchasing',
    network: 'visa',
    interchange: { percent: 0.0265, fixed: 0.10 },
    funFact: 'Business credit cards carry higher interchange to compensate issuers for B2B credit risk. Common at office supply stores and trade-supply MCCs.',
  },
  // ── INTERNATIONAL ────────────────────────────────────────────────────
  {
    id: 'visa-international',
    category: 'international',
    name: 'Visa International',
    sublabel: 'Foreign-issued card',
    network: 'visa',
    interchange: { percent: 0.0151, fixed: 0.10 },
    surcharge: { percent: 0.01, fixed: 0 }, // ISA + cross-border combined
    badge: { text: '+1% cross-border', tone: 'amber' },
    funFact: 'Foreign-issued cards add a "cross-border fee" (0.40–1.00%) plus an "international service assessment" (0.40–0.80%) on top of base interchange. Tourist-heavy stores notice this on their statements.',
  },
  // ── EBT ──────────────────────────────────────────────────────────────
  {
    id: 'ebt-snap',
    category: 'ebt',
    name: 'EBT SNAP',
    sublabel: 'Food benefits',
    network: 'ebt',
    interchange: { percent: 0, fixed: 0 },
    badge: { text: 'Free by federal law', tone: 'green' },
    funFact: 'The USDA Farm Bill prohibits charging merchants any interchange or processing fees for SNAP transactions. The federal government subsidizes the entire EBT rail. Many flat-rate processors (Square, Stripe) do not support EBT — you need an EBT-certified gateway.',
  },
];

export const CARD_CATEGORIES = [
  { id: 'debit',         name: 'Debit',           description: 'Funds pulled directly from checking' },
  { id: 'credit',        name: 'Standard credit', description: 'No-frills consumer credit cards' },
  { id: 'rewards',       name: 'Rewards / Premium', description: 'Points, miles, cash-back — funded by interchange' },
  { id: 'business',      name: 'Business',        description: 'Corporate / purchasing cards' },
  { id: 'international', name: 'International',   description: 'Foreign-issued cards' },
  { id: 'ebt',           name: 'EBT',             description: 'Food benefits — separate rail, free to merchants' },
];

/**
 * Each pricing model is how the acquirer/processor charges the merchant on top
 * of (or in place of, for flat rate) the interchange + assessments.
 */
export const PROCESSING_MODELS = [
  {
    id: 'ic-plus',
    name: 'Interchange-Plus',
    sublabel: 'Transparent — see real interchange',
    type: 'pass-through',
    markup: { percent: 0.0010, fixed: 0.10 },
    description: 'You pay actual interchange + assessments + a small transparent markup. Statement shows real interchange categories. Standard for serious merchants.',
    transparent: true,
  },
  {
    id: 'flat-square',
    name: 'Square (in-person)',
    sublabel: 'Flat 2.6% + $0.10',
    type: 'flat',
    flat: { percent: 0.026, fixed: 0.10 },
    description: 'One predictable rate. Easy to budget but expensive on debit (you overpay vs Durbin) and on small tickets.',
  },
  {
    id: 'flat-stripe',
    name: 'Stripe (online)',
    sublabel: 'Flat 2.9% + $0.30',
    type: 'flat',
    flat: { percent: 0.029, fixed: 0.30 },
    description: 'Online-first pricing. The $0.30 fixed fee dominates on small tickets — a $5 sale costs almost 9% in effective rate.',
  },
  {
    id: 'membership',
    name: 'Membership / Wholesale',
    sublabel: 'IC + $0.08, monthly fee',
    type: 'pass-through',
    monthly: 25,
    markup: { percent: 0, fixed: 0.08 },
    description: 'Pay a monthly fee for wholesale interchange + a tiny per-transaction. Cheapest at high volume (Helcim, Stax).',
  },
];

/**
 * Calculate fee breakdown for a single transaction.
 *
 * For pass-through (interchange-plus, membership): merchant pays
 *   interchange + assessments + processor markup.
 *
 * For flat-rate (Square, Stripe): merchant pays a single flat fee. The
 * processor pays interchange + assessments out of that fee internally; their
 * margin is what's left. We expose all three components so merchants can see
 * who actually keeps each slice on a per-card basis.
 */
export function calculateBreakdown({ amount, cardId, modelId }) {
  const card = CARD_TYPES.find((c) => c.id === cardId);
  const model = PROCESSING_MODELS.find((m) => m.id === modelId);
  if (!card || !model || !amount || amount <= 0) return null;

  // EBT bypasses every fee layer by USDA rule
  if (card.network === 'ebt') {
    return {
      amount,
      interchange: 0,
      surcharge: 0,
      assessments: 0,
      processorMarkup: 0,
      totalFees: 0,
      merchantNet: amount,
      effectiveRate: 0,
      card,
      model,
      network: NETWORKS.ebt,
      pricingModel: 'free',
      ebt: true,
      warning: model.type === 'flat'
        ? `${model.name} does not actually accept EBT — most flat-rate processors lack USDA certification. EBT requires an EBT-certified gateway.`
        : null,
    };
  }

  const network = NETWORKS[card.network];
  const baseInterchange = amount * card.interchange.percent + card.interchange.fixed;
  const surcharge = card.surcharge
    ? amount * card.surcharge.percent + card.surcharge.fixed
    : 0;
  const interchange = baseInterchange + surcharge;

  const assessments = amount * network.assessment + network.perTx;

  let processorMarkup;
  let totalFees;

  if (model.type === 'flat') {
    totalFees = amount * model.flat.percent + model.flat.fixed;
    processorMarkup = totalFees - interchange - assessments;
  } else {
    processorMarkup = amount * model.markup.percent + model.markup.fixed;
    totalFees = interchange + assessments + processorMarkup;
  }

  const merchantNet = amount - totalFees;

  return {
    amount,
    interchange,
    surcharge,
    assessments,
    processorMarkup,
    totalFees,
    merchantNet,
    effectiveRate: amount > 0 ? totalFees / amount : 0,
    card,
    model,
    network,
    pricingModel: model.type,
  };
}

/**
 * Project annual cost from a single-tx breakdown across an estimated volume.
 */
export function projectAnnual({ breakdown, monthlyTx }) {
  if (!breakdown) return null;
  const yearlyTx = monthlyTx * 12;
  const yearlyFees = breakdown.totalFees * yearlyTx;
  const yearlyMembership = breakdown.model?.monthly ? breakdown.model.monthly * 12 : 0;
  return {
    yearlyTx,
    yearlyFees,
    yearlyMembership,
    yearlyTotal: yearlyFees + yearlyMembership,
    yearlyVolume: breakdown.amount * yearlyTx,
  };
}
