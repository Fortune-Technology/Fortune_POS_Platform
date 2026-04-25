/**
 * internalApiKey.js
 *
 * Verify the inbound `X-Internal-Api-Key` header for service-to-service
 * calls from the POS backend (e.g. HPP webhook → ecom payment-status update).
 *
 * Same shared secret as backend/src/middleware/internalApiKey.js — the
 * POS backend sends the key, we verify it equals INTERNAL_API_KEY here.
 */

import crypto from 'crypto';

export function requireInternalApiKey(req, res, next) {
  const provided = req.get('x-internal-api-key') || req.get('X-Internal-Api-Key');
  const expected = process.env.INTERNAL_API_KEY;

  if (!expected) {
    console.error('[ecom internalApiKey] INTERNAL_API_KEY not set in env — refusing all internal calls');
    return res.status(500).json({ ok: false, error: 'Internal API not configured' });
  }
  if (!provided) {
    return res.status(401).json({ ok: false, error: 'Missing X-Internal-Api-Key header' });
  }

  // Constant-time compare
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ ok: false, error: 'Invalid internal API key' });
  }
  return next();
}
