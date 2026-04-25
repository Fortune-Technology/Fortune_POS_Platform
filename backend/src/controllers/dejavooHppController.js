/**
 * dejavooHppController.js
 *
 * HTTP handlers for Dejavoo / iPOSpays HPP — online checkout.
 * Mounted at /api/payment/dejavoo/hpp/*.
 *
 * ─── Endpoints ────────────────────────────────────────────────────────
 *   POST /api/payment/dejavoo/hpp/create-session   — internal (X-Internal-Api-Key)
 *   POST /api/payment/dejavoo/hpp/webhook/:secret  — public  (Authorization header verified)
 *   POST /api/admin/payment-merchants/:id/regenerate-hpp-secret — superadmin
 *   GET  /api/admin/payment-merchants/:id/hpp-webhook-url       — superadmin
 *
 * ─── Auth model ───────────────────────────────────────────────────────
 *   create-session  — server-to-server. Auth via shared INTERNAL_API_KEY.
 *   webhook         — public, no JWT. Trust comes from (a) per-store opaque
 *                     secret in URL path, (b) Authorization header set to
 *                     "Bearer <secret>" by iPOSpays (we set that value when
 *                     creating the session, iPOSpays echoes it on the webhook).
 *   regenerate /
 *   webhook-url     — superadmin only (router-level guard).
 */

import crypto from 'crypto';
import prisma from '../config/postgres.js';
import { encrypt, decrypt, randomToken, mask } from '../utils/cryptoVault.js';
import {
  createCheckoutSession,
  parseHppResponse,
  verifyWebhookAuthHeader,
  mapStatus,
  buildNotifyUrl,
  generateReferenceId,
} from '../services/dejavooHppService.js';

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

function getBackendUrl() {
  return (
    process.env.BACKEND_URL ||
    process.env.API_BASE_URL ||
    'http://localhost:5000'
  ).replace(/\/$/, '');
}

/**
 * Decrypt a merchant's HPP credentials in-memory. Never persists plaintext.
 * Throws if HPP isn't fully configured for this merchant.
 */
function decryptForHpp(merchant) {
  if (!merchant) throw new Error('Merchant not found');
  if (merchant.status !== 'active') {
    throw new Error(`Merchant is ${merchant.status}; HPP processing blocked`);
  }
  if (!merchant.hppEnabled) {
    throw new Error('HPP is not enabled for this merchant');
  }
  if (!merchant.hppMerchantId || !merchant.hppAuthKey) {
    throw new Error('HPP credentials not configured');
  }
  if (!merchant.hppWebhookSecret) {
    throw new Error('HPP webhook secret not configured (regenerate from admin panel)');
  }

  const hppAuthKey = decrypt(merchant.hppAuthKey);
  if (!hppAuthKey) throw new Error('HPP auth key decrypt failed');

  const hppWebhookSecret = decrypt(merchant.hppWebhookSecret);
  if (!hppWebhookSecret) throw new Error('HPP webhook secret decrypt failed');

  return { ...merchant, hppAuthKey, hppWebhookSecret };
}

/**
 * Best-effort callback to ecom-backend so it can mark its EcomOrder paid/failed.
 * We don't await — webhook still returns 200 to iPOSpays even if ecom is down,
 * because PaymentTransaction has the source of truth (ecom can reconcile later).
 */
async function notifyEcomBackend({ orderId, storeId, status, paymentTransactionId, amount, last4, cardType, authCode }) {
  const ecomUrl     = process.env.ECOM_BACKEND_URL;
  const internalKey = process.env.INTERNAL_API_KEY;
  if (!ecomUrl || !internalKey) {
    console.warn('[hppController] ECOM_BACKEND_URL or INTERNAL_API_KEY not set — skipping ecom notify');
    return;
  }
  try {
    await fetch(`${ecomUrl.replace(/\/$/, '')}/api/internal/orders/payment-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Api-Key': internalKey,
      },
      body: JSON.stringify({
        orderId, storeId, status, paymentTransactionId,
        amount, last4, cardType, authCode,
      }),
    });
  } catch (err) {
    console.error('[hppController] notifyEcomBackend failed:', err.message);
  }
}

// ═════════════════════════════════════════════════════════════════════════
// POST /api/payment/dejavoo/hpp/create-session
// Called by ecom-backend (internal API key). Returns the paymentUrl that
// the storefront redirects the shopper to.
// ═════════════════════════════════════════════════════════════════════════

export const dejavooHppCreateSession = async (req, res) => {
  try {
    const {
      storeId,
      orderId,
      amount,
      customerEmail,
      customerName,
      customerPhone,
      description,
      returnUrl,
      failureUrl,
      cancelUrl,
      // Optional storefront branding
      merchantName,
      logoUrl,
      themeColor,
      // Override the computed webhook URL (rarely needed)
      notifyUrl: overrideNotifyUrl,
    } = req.body;

    if (!storeId)   return res.status(400).json({ success: false, error: 'storeId is required' });
    if (!orderId)   return res.status(400).json({ success: false, error: 'orderId is required' });
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'amount must be > 0' });
    }
    if (!returnUrl) return res.status(400).json({ success: false, error: 'returnUrl is required' });

    const merchantRow = await prisma.paymentMerchant.findUnique({ where: { storeId } });
    if (!merchantRow) {
      return res.status(404).json({ success: false, error: 'No payment merchant configured for this store' });
    }

    let merchant;
    try {
      merchant = decryptForHpp(merchantRow);
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    // Generate a unique reference for this checkout attempt. We store it as
    // `retref` and pass it as iPOSpays' `transactionReferenceId` — the webhook
    // echoes it back so we can find this PaymentTransaction.
    const transactionReferenceId = generateReferenceId();
    const notifyUrl = overrideNotifyUrl || buildNotifyUrl(getBackendUrl(), merchant.hppWebhookSecret);

    const result = await createCheckoutSession(merchant, {
      transactionReferenceId,
      amount,
      customerEmail, customerName, customerPhone,
      description,
      returnUrl, failureUrl, cancelUrl,
      merchantName, logoUrl, themeColor,
      notifyUrl,
    });

    if (!result.approved || !result.paymentUrl) {
      return res.status(502).json({
        success: false,
        error:   result.message || 'iPOSpays did not return a payment URL',
        raw:     result._raw,
      });
    }

    // Log the pending transaction so the webhook can find + finalise it.
    const paymentTx = await prisma.paymentTransaction.create({
      data: {
        orgId:         merchant.orgId,
        storeId:       merchant.storeId,
        merchantId:    merchant.id,
        provider:      'dejavoo',
        txSource:      'ecom',
        ecomOrderId:   orderId,
        retref:        transactionReferenceId,
        amount,
        type:          'sale',
        status:        'pending',
        respText:      'HPP session created — awaiting payment',
        invoiceNumber: orderId,
      },
    });

    return res.json({
      success:                true,
      paymentUrl:             result.paymentUrl,
      transactionReferenceId,
      paymentTransactionId:   paymentTx.id,
    });
  } catch (err) {
    console.error('[dejavooHppCreateSession]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ═════════════════════════════════════════════════════════════════════════
// POST /api/payment/dejavoo/hpp/webhook/:secret
//
// iPOSpays posts the iposHPResponse here. Trust comes from:
//   1. Per-store opaque secret in the URL path → look up merchant
//   2. Authorization header value matches "Bearer <secret>" (constant-time)
// ═════════════════════════════════════════════════════════════════════════

export const dejavooHppWebhook = async (req, res) => {
  try {
    const { secret } = req.params;
    if (!secret) return res.status(400).json({ ok: false, error: 'Missing secret in URL' });

    // Find the merchant whose webhook secret decrypts to this URL value.
    // Linear scan over hpp-enabled merchants — fine at the scale of dozens
    // to a few hundred merchants per server. At higher scale, add a stable
    // hash column for indexed lookup.
    const merchants = await prisma.paymentMerchant.findMany({
      where: { hppEnabled: true, hppWebhookSecret: { not: null } },
      select: {
        id: true, orgId: true, storeId: true,
        hppAuthKey: true, hppWebhookSecret: true,
        provider: true, environment: true,
      },
    });

    const merchant = merchants.find(m => decrypt(m.hppWebhookSecret) === secret);
    if (!merchant) {
      console.warn('[hppWebhook] Unknown webhook secret — possible probe or rotated secret');
      return res.status(401).json({ ok: false, error: 'Unknown webhook secret' });
    }

    // Verify Authorization header matches what we set as `authHeader` when
    // creating the session. iPOSpays sends our value back to us verbatim.
    const incoming = req.get('authorization') || req.get('Authorization') || '';
    if (!verifyWebhookAuthHeader(incoming, secret)) {
      console.warn(`[hppWebhook] Authorization mismatch for merchant ${merchant.id} — rejecting`);
      return res.status(401).json({ ok: false, error: 'Invalid Authorization' });
    }

    // Parse the iposHPResponse envelope
    const payload = parseHppResponse(req.body);
    const mappedStatus = mapStatus(payload.status);
    const ref = payload.transactionReferenceId;

    if (!ref) {
      console.warn('[hppWebhook] Missing transactionReferenceId — cannot correlate');
      return res.status(400).json({ ok: false, error: 'Webhook missing transactionReferenceId' });
    }

    // Idempotency: find the pending PaymentTransaction we wrote at create-session
    let tx = await prisma.paymentTransaction.findFirst({
      where: { merchantId: merchant.id, retref: ref, txSource: 'ecom' },
    });

    // If we already finalised this transaction, ack but don't double-update
    if (tx && tx.status !== 'pending') {
      return res.json({ ok: true, idempotent: true, paymentTransactionId: tx.id });
    }

    if (tx) {
      tx = await prisma.paymentTransaction.update({
        where: { id: tx.id },
        data: {
          status:        mappedStatus,
          authCode:      payload.authCode       || tx.authCode,
          respCode:      payload.responseCode != null ? String(payload.responseCode) : tx.respCode,
          respText:      payload.responseMessage || `HPP webhook: ${payload.status}`,
          lastFour:      payload.cardLast4Digit  || tx.lastFour,
          acctType:      payload.cardType        || tx.acctType,
          token:         payload.cardToken       || tx.token,
          capturedAmount: mappedStatus === 'approved' ? Number(payload.totalAmount || payload.amount || tx.amount) : tx.capturedAmount,
        },
      });
    } else {
      // No pending row found — write one (rare; only if create-session DB write failed)
      tx = await prisma.paymentTransaction.create({
        data: {
          orgId:         merchant.orgId,
          storeId:       merchant.storeId,
          merchantId:    merchant.id,
          provider:      'dejavoo',
          txSource:      'ecom',
          retref:        ref,
          amount:        Number(payload.amount || payload.totalAmount || 0),
          type:          'sale',
          status:        mappedStatus,
          authCode:      payload.authCode,
          respCode:      payload.responseCode != null ? String(payload.responseCode) : null,
          respText:      payload.responseMessage || `HPP webhook: ${payload.status} (no prior session row)`,
          lastFour:      payload.cardLast4Digit,
          acctType:      payload.cardType,
          token:         payload.cardToken,
        },
      });
    }

    // Best-effort notify ecom-backend (don't block the webhook on it)
    if (tx.ecomOrderId) {
      notifyEcomBackend({
        orderId:              tx.ecomOrderId,
        storeId:              merchant.storeId,
        status:               mappedStatus,
        paymentTransactionId: tx.id,
        amount:               payload.totalAmount || payload.amount,
        last4:                payload.cardLast4Digit,
        cardType:             payload.cardType,
        authCode:             payload.authCode,
      }).catch(err => console.error('[hppWebhook] notify ecom failed:', err.message));
    }

    return res.json({ ok: true, paymentTransactionId: tx.id, status: mappedStatus });
  } catch (err) {
    console.error('[dejavooHppWebhook]', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};

// ═════════════════════════════════════════════════════════════════════════
// POST /api/admin/payment-merchants/:id/regenerate-hpp-secret
// Returns plaintext secret + URL ONCE. Admin pastes URL into iPOSpays.
// ═════════════════════════════════════════════════════════════════════════

export const regenerateHppWebhookSecret = async (req, res) => {
  try {
    const merchant = await prisma.paymentMerchant.findUnique({ where: { id: req.params.id } });
    if (!merchant) return res.status(404).json({ success: false, error: 'Merchant not found' });

    const newSecret = randomToken();
    await prisma.paymentMerchant.update({
      where: { id: merchant.id },
      data: {
        hppWebhookSecret: encrypt(newSecret),
        updatedById:      req.user?.id || null,
      },
    });

    return res.json({
      success:       true,
      webhookSecret: newSecret,                                     // plaintext, ONCE
      webhookUrl:    buildNotifyUrl(getBackendUrl(), newSecret),
      preview:       mask(newSecret, 8),
    });
  } catch (err) {
    console.error('[regenerateHppWebhookSecret]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ═════════════════════════════════════════════════════════════════════════
// GET /api/admin/payment-merchants/:id/hpp-webhook-url
// Returns the current webhook URL (full plaintext URL — the URL itself IS
// the secret, but it's already known to whoever paste it into iPOSpays so
// re-displaying is fine for ongoing admin use).
// ═════════════════════════════════════════════════════════════════════════

export const getHppWebhookUrl = async (req, res) => {
  try {
    const merchant = await prisma.paymentMerchant.findUnique({ where: { id: req.params.id } });
    if (!merchant) return res.status(404).json({ success: false, error: 'Merchant not found' });
    if (!merchant.hppWebhookSecret) {
      return res.json({ success: true, configured: false, webhookUrl: null });
    }
    const secret = decrypt(merchant.hppWebhookSecret);
    if (!secret) {
      return res.status(500).json({ success: false, error: 'Webhook secret could not be decrypted' });
    }
    return res.json({
      success:    true,
      configured: true,
      webhookUrl: buildNotifyUrl(getBackendUrl(), secret),
      preview:    mask(secret, 8),
    });
  } catch (err) {
    console.error('[getHppWebhookUrl]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
