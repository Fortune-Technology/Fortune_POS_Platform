/**
 * paymentService.js
 *
 * Service-to-service client for the POS-backend Dejavoo HPP endpoints.
 * The ecom-backend itself never holds Dejavoo credentials — the POS backend
 * is the only process that can decrypt them. This client just authenticates
 * with the shared INTERNAL_API_KEY and lets the POS backend do the work.
 *
 *   storefront → ecom-backend.checkout()
 *              → POS-backend.createCheckoutSession()  ← we live here
 *              → iPOSpays HPP API
 *              → returns paymentUrl
 *
 * iPOSpays' webhook lands directly on the POS backend (it has the secret +
 * verification logic). The POS backend then calls back to ecom-backend's
 * /api/internal/orders/payment-status to flip the EcomOrder status.
 */

const POS_BACKEND_URL = (process.env.POS_BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '');
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

if (!INTERNAL_API_KEY) {
  console.warn('[paymentService] INTERNAL_API_KEY not set — HPP checkout will fail with 401');
}

/**
 * Ask the POS backend to start a hosted-payment-page session.
 *
 * @param {object} params
 * @param {string} params.storeId       POS store ID (req.storeId from middleware)
 * @param {string} params.orderId       EcomOrder.id we just created
 * @param {number} params.amount        Total in dollars
 * @param {string} params.returnUrl     Where iPOSpays sends shopper after success
 * @param {string} [params.failureUrl]
 * @param {string} [params.cancelUrl]
 * @param {string} [params.customerEmail]
 * @param {string} [params.customerName]
 * @param {string} [params.customerPhone]
 * @param {string} [params.description]   Order description shown on hosted page
 * @param {string} [params.merchantName]  Branding shown on hosted page
 * @param {string} [params.logoUrl]
 * @param {string} [params.themeColor]
 *
 * @returns {Promise<{
 *   success: boolean,
 *   paymentUrl?: string,
 *   transactionReferenceId?: string,
 *   paymentTransactionId?: string,
 *   error?: string,
 * }>}
 */
export async function createHppSession(params) {
  if (!INTERNAL_API_KEY) {
    return { success: false, error: 'INTERNAL_API_KEY not configured on ecom-backend' };
  }
  const url = `${POS_BACKEND_URL}/api/payment/dejavoo/hpp/create-session`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Api-Key': INTERNAL_API_KEY,
      },
      body: JSON.stringify(params),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        success: false,
        error: body?.error || `POS backend returned ${res.status}`,
      };
    }
    return {
      success: true,
      paymentUrl:             body.paymentUrl,
      transactionReferenceId: body.transactionReferenceId,
      paymentTransactionId:   body.paymentTransactionId,
    };
  } catch (err) {
    return {
      success: false,
      error: `Could not reach POS backend at ${url}: ${err.message}`,
    };
  }
}
