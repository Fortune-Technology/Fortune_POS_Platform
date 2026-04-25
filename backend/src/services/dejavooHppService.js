/**
 * dejavooHppService.js
 *
 * Dejavoo / iPOSpays HPP (Hosted Payment Page) client for online checkout.
 * Counterpart to dejavooSpinService.js (which handles in-person card-present).
 *
 * ─── Flow ────────────────────────────────────────────────────────────────
 *   1. Storefront → ecom-backend → POS-backend.createCheckoutSession()
 *   2. We POST to iPOSpays HPP API; receive { message, information } where
 *      `information` is the hosted-page URL
 *   3. We log a `pending` PaymentTransaction (txSource='ecom') with retref =
 *      our generated transactionReferenceId
 *   4. Storefront redirects shopper to the `information` URL
 *   5. Shopper enters card on iPOSpays' hosted page (PCI scope is theirs)
 *   6. iPOSpays redirects shopper back to our returnUrl / failureUrl / cancelUrl
 *   7. iPOSpays also POSTs notifyByPOST URL with the iposHPResponse payload
 *   8. Our webhook verifies the Authorization header matches our authHeader
 *      value, updates the PaymentTransaction, tells ecom-backend the order
 *      is paid/failed
 *
 * ─── iPOSpays HPP doc ───────────────────────────────────────────────────
 *   https://docs.ipospays.com/hosted-payment-page/apidocs
 *   UAT docs: https://uatdocs.ipospays.tech/
 *   Support:  devsupport@dejavoo.io
 *
 * ─── Multi-tenant ───────────────────────────────────────────────────────
 * Every method takes a decrypted `merchant` object containing:
 *   { hppMerchantId (TPN), hppAuthKey (JWT token), hppBaseUrl,
 *     hppWebhookSecret, environment }
 * The service never reads the DB or env directly for credentials.
 */

import axios from 'axios';
import crypto from 'crypto';

// ═════════════════════════════════════════════════════════════════════════
// HPP API SPEC — verified against https://docs.ipospays.com/hosted-payment-page/apidocs
// All iPOSpays-specific magic strings live here.
// ═════════════════════════════════════════════════════════════════════════

const HPP_API_SPEC = {
  // Base URLs by environment. Default to env vars; per-merchant override
  // in PaymentMerchant.hppBaseUrl wins if set.
  envBaseUrls: {
    uat:  process.env.DEJAVOO_HPP_BASE_UAT  || 'https://payment.ipospays.tech',
    prod: process.env.DEJAVOO_HPP_BASE_PROD || 'https://payment.ipospays.com',
  },

  // Query-status API has its own host (split from the main payment API).
  queryStatusBaseUrls: {
    uat:  process.env.DEJAVOO_HPP_QUERY_BASE_UAT  || 'https://api.ipospays.tech',
    prod: process.env.DEJAVOO_HPP_QUERY_BASE_PROD || 'https://api.ipospays.com',
  },

  // Endpoint paths (relative to base URLs above).
  paths: {
    createSession: '/api/v1/external-payment-transaction/getHostedPaymentPage',
    queryStatus:   '/v1/queryPaymentStatus',
  },

  // Transaction type codes from the iPOSpays doc.
  txType: {
    SALE:            1,
    CARD_VALIDATION: 2,   // $0 preauth — used for card-on-file capture
  },

  // Response code mapping from the iPOSpays doc.
  responseCodes: {
    200: 'approved',
    400: 'declined',
    401: 'cancelled',
    402: 'rejected',
  },
};

// ═════════════════════════════════════════════════════════════════════════
// Base URL resolution
// ═════════════════════════════════════════════════════════════════════════

function resolveBaseUrl(merchant) {
  if (merchant.hppBaseUrl) return String(merchant.hppBaseUrl).replace(/\/$/, '');
  const env = merchant.environment === 'prod' ? 'prod' : 'uat';
  return HPP_API_SPEC.envBaseUrls[env].replace(/\/$/, '');
}

function resolveQueryStatusBaseUrl(merchant) {
  const env = merchant.environment === 'prod' ? 'prod' : 'uat';
  return HPP_API_SPEC.queryStatusBaseUrls[env].replace(/\/$/, '');
}

// ═════════════════════════════════════════════════════════════════════════
// Helpers
// ═════════════════════════════════════════════════════════════════════════

/**
 * iPOSpays expects amounts as STRING in cents, never decimals.
 *   $100.00 → "10000"
 *   $1.50   → "150"
 */
function toCents(dollars) {
  if (dollars == null) return undefined;
  return String(Math.round(Number(dollars) * 100));
}

/**
 * Build the value we'll set as `notificationOption.authHeader` when creating
 * the session. iPOSpays will then post the webhook back to us with the
 * exact same value as the `Authorization` request header. We compare
 * equality (constant-time) to verify the inbound webhook is genuine.
 *
 * Convention: prefix the secret with "Bearer " so it looks like a normal
 * Authorization header value to iPOSpays' validation.
 */
export function buildAuthHeaderValue(secret) {
  return `Bearer ${secret}`;
}

/**
 * Generate a unique transactionReferenceId for a checkout session.
 * iPOSpays echoes this back in both the redirect query and the webhook,
 * which is how we correlate the payment to our PaymentTransaction row.
 */
export function generateReferenceId() {
  return crypto.randomUUID();
}

// ═════════════════════════════════════════════════════════════════════════
// PUBLIC METHODS
// ═════════════════════════════════════════════════════════════════════════

/**
 * Create a hosted checkout session.
 *
 * @param {object} merchant
 *   { hppMerchantId, hppAuthKey, hppBaseUrl?, hppWebhookSecret, environment }
 *   All credentials must already be DECRYPTED by the caller.
 *
 * @param {object} opts
 * @param {number} opts.amount               Total amount in dollars (e.g. 49.80)
 * @param {string} opts.transactionReferenceId  Unique merchant ref (use generateReferenceId())
 * @param {string} opts.notifyUrl            Our public webhook URL for this store
 * @param {string} opts.returnUrl            Where to redirect on payment success
 * @param {string} opts.failureUrl           Where to redirect on decline (defaults to returnUrl)
 * @param {string} opts.cancelUrl            Where to redirect on cancel (defaults to returnUrl)
 * @param {string} [opts.customerName]
 * @param {string} [opts.customerEmail]
 * @param {string} [opts.customerPhone]
 * @param {string} [opts.merchantName]       Branding shown on hosted page
 * @param {string} [opts.logoUrl]
 * @param {string} [opts.themeColor]         Hex (e.g. "#3d56b5")
 * @param {string} [opts.description]        Order description shown on hosted page
 * @param {object} [opts.fees]               { feeAmount, feeLabel } (cents)
 * @param {object} [opts.taxes]              { lTax: { amount, label }, gTax: { amount, label } }
 * @param {number} [opts.expiryMinutes]      How long the hosted page is valid (default 5)
 * @param {boolean} [opts.requestCardToken]  Tokenize for card-on-file (default false)
 *
 * @returns {Promise<{
 *   approved: boolean,
 *   paymentUrl: string|null,        ← from `information` in response
 *   transactionReferenceId: string,
 *   message: string|null,
 *   _raw: object|null,
 * }>}
 */
export async function createCheckoutSession(merchant, opts) {
  if (!merchant.hppMerchantId)    throw new Error('hppMerchantId (TPN) is required on merchant');
  if (!merchant.hppAuthKey)       throw new Error('hppAuthKey (token) is required on merchant (decrypt before passing)');
  if (!merchant.hppWebhookSecret) throw new Error('hppWebhookSecret is required on merchant (used as webhook auth)');
  if (!opts.amount || opts.amount <= 0) throw new Error('amount must be > 0');
  if (!opts.transactionReferenceId) throw new Error('transactionReferenceId is required');
  if (!opts.notifyUrl) throw new Error('notifyUrl is required');
  if (!opts.returnUrl) throw new Error('returnUrl is required');

  const failureUrl = opts.failureUrl || opts.returnUrl;
  const cancelUrl  = opts.cancelUrl  || opts.returnUrl;
  const expiry     = Math.max(1, Math.min(60, opts.expiryMinutes || 5));

  // Build the iPOSpays HPP request body. Field names + structure match the
  // iPOSpays HPP API doc. The `token` here is iPOSpays' API auth token (the
  // JWT from the merchant's iPOSpays portal), passed in the BODY (not header).
  const body = {
    token: merchant.hppAuthKey,

    merchantAuthentication: {
      merchantId:             merchant.hppMerchantId,                   // TPN
      transactionReferenceId: opts.transactionReferenceId,
    },

    transactionRequest: {
      transactionType: HPP_API_SPEC.txType.SALE,                        // 1 = SALE
      amount:          toCents(opts.amount),                            // string cents
      calculateFee:    !!opts.fees,
      calculateTax:    !!opts.taxes,
      tipsInputPrompt: false,
      expiry,
    },

    notificationOption: {
      // Browser redirects after the shopper completes the hosted page
      notifyByRedirect: true,
      returnUrl:        opts.returnUrl,
      failureUrl,
      cancelUrl,

      // Server-to-server webhook for asynchronous status confirmation.
      // The authHeader value will be sent BACK to us by iPOSpays as the
      // `Authorization` HTTP header on the webhook POST. We compare equality
      // to verify the call is genuine.
      notifyByPOST: true,
      postAPI:      opts.notifyUrl,
      authHeader:   buildAuthHeaderValue(merchant.hppWebhookSecret),

      notifyBySMS:  false,
    },

    preferences: {
      integrationType:    1,                              // 1 = redirect-based HPP
      avsVerification:    false,
      eReceipt:           !!opts.customerEmail,
      eReceiptInputPrompt: false,
      requestCardToken:   !!opts.requestCardToken,
      shortenURL:         false,
      sendPaymentLink:    false,
      integrationVersion: 'v2',
    },
  };

  // Optional customer info — iPOSpays uses these for receipts + AVS
  if (opts.customerName)  body.preferences.customerName   = opts.customerName;
  if (opts.customerEmail) body.preferences.customerEmail  = opts.customerEmail;
  if (opts.customerPhone) body.preferences.customerMobile = opts.customerPhone;

  // Optional fee + tax breakdown
  if (opts.fees?.feeAmount) {
    body.transactionRequest.feeAmount = toCents(opts.fees.feeAmount);
    body.transactionRequest.feeLabel  = opts.fees.feeLabel || 'Processing Fee';
  }
  if (opts.taxes?.lTax?.amount) {
    body.transactionRequest.lTaxAmount = toCents(opts.taxes.lTax.amount);
    body.transactionRequest.lTaxLabel  = opts.taxes.lTax.label || 'Local Tax';
  }
  if (opts.taxes?.gTax?.amount) {
    body.transactionRequest.gTaxAmount = toCents(opts.taxes.gTax.amount);
    body.transactionRequest.gTaxLabel  = opts.taxes.gTax.label || 'State Tax';
  }

  // Optional storefront branding (merchantName/logo show up on hosted page)
  if (opts.merchantName || opts.logoUrl || opts.themeColor || opts.description) {
    body.personalization = {};
    if (opts.merchantName) body.personalization.merchantName     = opts.merchantName;
    if (opts.logoUrl)      body.personalization.logoUrl          = opts.logoUrl;
    if (opts.themeColor)   body.personalization.themeColor       = opts.themeColor;
    if (opts.description)  body.personalization.description      = opts.description;
  }

  const baseURL = resolveBaseUrl(merchant);
  try {
    const { data } = await axios.post(`${baseURL}${HPP_API_SPEC.paths.createSession}`, body, {
      timeout: 30 * 1000,
      headers: { 'Content-Type': 'application/json' },
    });
    // Successful response shape: { message: "Url generated successfully", information: "<url>" }
    const paymentUrl = data?.information || null;
    return {
      approved:                paymentUrl != null,
      paymentUrl,
      transactionReferenceId:  opts.transactionReferenceId,
      message:                 data?.message || null,
      _raw:                    data,
    };
  } catch (err) {
    return {
      approved:                false,
      paymentUrl:              null,
      transactionReferenceId:  opts.transactionReferenceId,
      message:                 err.response?.data?.message
                            || err.response?.data?.error
                            || err.message
                            || 'Failed to create checkout session',
      _raw:                    err.response?.data ?? null,
    };
  }
}

/**
 * Query an existing payment's status. Used by the return-url handler to
 * confirm payment state synchronously when we want the storefront to show
 * a confirmed page even if the webhook is slightly delayed.
 *
 * @param {object} merchant   Decrypted merchant
 * @param {string} transactionReferenceId  Our reference (the one we sent in createSession)
 */
export async function queryPaymentStatus(merchant, transactionReferenceId) {
  if (!transactionReferenceId) throw new Error('transactionReferenceId is required');

  const baseURL = resolveQueryStatusBaseUrl(merchant);
  try {
    const { data } = await axios.get(`${baseURL}${HPP_API_SPEC.paths.queryStatus}`, {
      params: {
        merchantId:             merchant.hppMerchantId,
        transactionReferenceId,
      },
      headers: {
        'Content-Type': 'application/json',
        token:          merchant.hppAuthKey,    // queryStatus uses header token (per iPOSpays spec)
      },
      timeout: 15 * 1000,
    });
    return { ok: true, ...parseHppResponse(data), _raw: data };
  } catch (err) {
    return {
      ok:        false,
      message:   err.response?.data?.message || err.message,
      _raw:      err.response?.data ?? null,
    };
  }
}

// ═════════════════════════════════════════════════════════════════════════
// WEBHOOK / RESPONSE PARSING
// ═════════════════════════════════════════════════════════════════════════

/**
 * Verify an inbound webhook is genuine.
 *
 * iPOSpays HPP doesn't sign webhooks with HMAC. Instead, when we created
 * the session we passed `notificationOption.authHeader = "Bearer <secret>"`.
 * iPOSpays sends that exact value back to us as the `Authorization` HTTP
 * header when posting the webhook. We compare equality (constant-time) to
 * confirm authenticity.
 *
 * @param {string} incomingAuthHeader   req.headers.authorization
 * @param {string} expectedSecret       Decrypted merchant.hppWebhookSecret
 */
export function verifyWebhookAuthHeader(incomingAuthHeader, expectedSecret) {
  if (!incomingAuthHeader || !expectedSecret) return false;
  const expected = buildAuthHeaderValue(expectedSecret);
  const a = Buffer.from(String(incomingAuthHeader).trim());
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Parse the iposHPResponse envelope from a webhook body OR a queryStatus
 * response. Returns a normalized object with our enum status.
 */
export function parseHppResponse(body) {
  // The webhook + query-status both wrap the data in `iposHPResponse`.
  // Defensive: also accept a flat shape in case iPOSpays sends both forms.
  const r = body?.iposHPResponse || body || {};

  const numericCode = Number(r.responseCode);
  const status = HPP_API_SPEC.responseCodes[numericCode] || 'pending';

  return {
    status,                                    // approved | declined | cancelled | rejected | pending
    responseCode:           numericCode || null,
    responseMessage:        r.responseMessage  || null,
    transactionReferenceId: r.transactionReferenceId || null,
    transactionId:          r.transactionId    || null,
    transactionNumber:      r.transactionNumber|| null,
    batchNumber:            r.batchNumber      || null,
    cardType:               r.cardType         || null,
    cardLast4Digit:         r.cardLast4Digit   || null,
    amount:                 r.amount           || null,         // dollars (string)
    totalAmount:            r.totalAmount      || null,
    tips:                   r.tips             || null,
    customFee:              r.customFee        || null,
    localTax:               r.localTax         || null,
    stateTax:               r.stateTax         || null,
    authCode:               r.responseApprovalCode || null,
    rrn:                    r.rrn              || null,
    cardToken:              r.cardToken        || null,
    avsRespMsg:             r.avsRespMsg       || null,
    consumerId:             r.consumerId       || null,
    errResponseCode:        r.errResponseCode  || null,
    errResponseMessage:     r.errResponseMessage || null,
    _raw:                   body,
  };
}

/**
 * Map our parsed status → PaymentTransaction.status enum.
 */
export function mapStatus(status) {
  switch (String(status || '').toLowerCase()) {
    case 'approved': return 'approved';
    case 'declined': return 'declined';
    case 'rejected': return 'declined';
    case 'cancelled': return 'voided';
    case 'pending':
    default:
      return 'pending';
  }
}

/**
 * Build the per-store webhook URL we hand to iPOSpays as `postAPI`.
 * The opaque secret in the path lets the webhook handler look up the merchant
 * before verifying the Authorization header.
 */
export function buildNotifyUrl(backendUrl, storeWebhookSecret) {
  const base = String(backendUrl || '').replace(/\/$/, '');
  return `${base}/api/payment/dejavoo/hpp/webhook/${storeWebhookSecret}`;
}

// Export the spec so tests + admin UI can reference it
export { HPP_API_SPEC };
