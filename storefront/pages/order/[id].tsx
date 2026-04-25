/**
 * Order page — also serves as the iPOSpays HPP return URL.
 *
 * After a card payment, iPOSpays redirects the shopper to
 *   /order/<id>?store=<slug>&email=<email>
 * The actual payment confirmation comes via the iPOSpays → POS-backend
 * webhook → ecom-backend `/api/internal/orders/payment-status` callback,
 * which flips the EcomOrder's paymentStatus from 'pending' to 'paid' (or
 * 'failed' / 'cancelled' if the shopper bailed or the bank declined).
 *
 * This page polls the public order lookup until paymentStatus is no
 * longer 'pending', then renders the confirmation / failure UI.
 */

import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import type { GetServerSidePropsContext } from 'next';
import { CheckCircle, AlertCircle, Loader2, Clock, Store, Truck } from 'lucide-react';
import { useRouter } from 'next/router';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import { useCart } from '../../lib/cart';
import { fetchPublicOrder, type PublicOrder } from '../../lib/api';
import axios from 'axios';
import type { Order } from '@storeveu/types';

function fmt(n: number | string): string {
  return `$${Number(n).toFixed(2)}`;
}

const ECOM_API = process.env.NEXT_PUBLIC_ECOM_API_URL || 'http://localhost:5005/api';

interface OrderLineItem {
  name:  string;
  qty:   number;
  price?: number;
  total?: number;
  [key: string]: unknown;
}

interface OrderDetail extends Order {
  fulfillmentType?: string;
  grandTotal?: number | string;
  paymentStatus?: string;
  paymentMethod?: string;
  cancelReason?: string;
  lineItems?: OrderLineItem[];
}

// How long to keep polling before giving up. iPOSpays webhook is usually
// near-instant, so 60s is generous. After this, the user can manually refresh.
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS  = 60_000;

export default function OrderConfirmationPage() {
  const router = useRouter();
  const { clearCart, storeSlug } = useCart();

  const idQ   = router.query.id;
  const slugQ = router.query.store;
  const emailQ = router.query.email;
  const id    = typeof idQ    === 'string' ? idQ    : Array.isArray(idQ)    ? idQ[0]    : '';
  const slug  = typeof slugQ  === 'string' ? slugQ  : Array.isArray(slugQ)  ? slugQ[0]  : '';
  const email = typeof emailQ === 'string' ? emailQ : Array.isArray(emailQ) ? emailQ[0] : '';
  const sq    = slug || storeSlug;

  const [order,   setOrder]   = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);

  // Refs so polling effect doesn't depend on changing values
  const pollStartedRef = useRef<number | null>(null);
  const cartClearedRef = useRef(false);

  // Single fetch attempt. Returns the order or null on failure.
  async function fetchOrderOnce(): Promise<OrderDetail | null> {
    // 1) Try customer-auth endpoint (logged-in shopper)
    const stored = typeof window !== 'undefined' ? localStorage.getItem('storv-customer') : null;
    let token: string | null = null;
    if (stored) {
      try { token = (JSON.parse(stored) as { token?: string }).token ?? null; } catch { token = null; }
    }
    if (token) {
      try {
        const r = await axios.get(`${ECOM_API}/store/${sq}/auth/orders/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.data?.data) return r.data.data as OrderDetail;
      } catch { /* fall through */ }
    }
    // 2) Public lookup by ID + email (the iPOSpays redirect carries email in query)
    if (email) {
      try {
        return (await fetchPublicOrder(sq, id, email)) as OrderDetail;
      } catch { /* fall through */ }
    }
    return null;
  }

  // Initial load + poll while paymentStatus === 'pending'
  useEffect(() => {
    if (!id || !sq) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      const o = await fetchOrderOnce();
      if (cancelled) return;

      if (o) {
        setOrder(o);
        setLoading(false);

        const isPending = o.paymentStatus === 'pending' && o.paymentMethod === 'card';

        if (isPending) {
          if (pollStartedRef.current == null) pollStartedRef.current = Date.now();
          const elapsed = Date.now() - pollStartedRef.current;
          if (elapsed < POLL_TIMEOUT_MS) {
            setPolling(true);
            timer = setTimeout(tick, POLL_INTERVAL_MS);
            return;
          }
          // Timed out — leave the page in pending state with a manual-refresh hint
          setPolling(false);
          return;
        }

        // Final state reached — clear cart on success (once)
        setPolling(false);
        if (o.paymentStatus === 'paid' && !cartClearedRef.current) {
          cartClearedRef.current = true;
          clearCart();
        }
        return;
      }

      // No order returned — either bad email or not yet committed; stop after one try
      setLoading(false);
      setPolling(false);
    }

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sq, email]);

  // ── Render branches ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <PageShell>
        <div className="oc-wrapper">
          <div className="oc-icon"><Loader2 size={48} className="oc-spinner" /></div>
          <h1 className="oc-title">Loading order…</h1>
        </div>
      </PageShell>
    );
  }

  // Pending payment — webhook hasn't confirmed yet
  if (order?.paymentStatus === 'pending' && order.paymentMethod === 'card') {
    return (
      <PageShell>
        <div className="oc-wrapper">
          <div className="oc-icon oc-icon--pending"><Clock size={48} strokeWidth={1.5} /></div>
          <h1 className="oc-title">Confirming your payment…</h1>
          <p className="oc-subtitle">
            {polling
              ? 'Hold tight — we\'re waiting for the payment processor to confirm.'
              : 'It\'s taking longer than usual. The page will update automatically when confirmation arrives, or refresh in a moment.'}
          </p>
          {order.orderNumber && (
            <div className="oc-details oc-details--compact">
              <div className="oc-row">
                <span className="oc-label">Order Number</span>
                <span className="oc-value">{order.orderNumber}</span>
              </div>
              {order.grandTotal != null && (
                <div className="oc-row">
                  <span className="oc-label">Total</span>
                  <span className="oc-value oc-value--bold">{fmt(order.grandTotal)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </PageShell>
    );
  }

  // Failed / cancelled
  if (order?.paymentStatus === 'failed' || order?.status === 'cancelled') {
    return (
      <PageShell>
        <div className="oc-wrapper">
          <div className="oc-icon oc-icon--failed"><AlertCircle size={48} strokeWidth={1.5} /></div>
          <h1 className="oc-title">Payment didn't go through</h1>
          <p className="oc-subtitle">
            {order.cancelReason || 'Your card was declined or the payment was cancelled. Your card has not been charged.'}
          </p>
          <Link href={`/checkout?store=${sq}`} className="cd-btn-checkout oc-continue-btn">
            Try Again
          </Link>
        </div>
      </PageShell>
    );
  }

  // Confirmed (paid OR cash-on-pickup)
  return (
    <PageShell>
      <div className="oc-wrapper">
        <div className="oc-icon"><CheckCircle size={48} strokeWidth={1.5} /></div>
        <h1 className="oc-title">Order Confirmed!</h1>
        <p className="oc-subtitle">
          {order?.paymentMethod === 'cash_on_pickup'
            ? 'Pay in cash when you pick up — see you soon!'
            : 'Thank you — your payment was successful.'}
        </p>

        {order && (
          <div className="oc-details">
            <div className="oc-row">
              <span className="oc-label">Order Number</span>
              <span className="oc-value">{order.orderNumber}</span>
            </div>
            <div className="oc-row">
              <span className="oc-label">Status</span>
              <span className="oc-status">{order.status}</span>
            </div>
            {order.fulfillmentType && (
              <div className="oc-row">
                <span className="oc-label">Fulfillment</span>
                <span className="oc-value">
                  {order.fulfillmentType === 'pickup'
                    ? <><Store size={14} /> Pickup</>
                    : <><Truck size={14} /> Delivery</>}
                </span>
              </div>
            )}
            {order.grandTotal != null && (
              <div className="oc-row">
                <span className="oc-label">Total</span>
                <span className="oc-value oc-value--bold">{fmt(order.grandTotal)}</span>
              </div>
            )}

            {order.lineItems && Array.isArray(order.lineItems) && (
              <div className="oc-items">
                <h3 className="oc-items-heading">Items</h3>
                {order.lineItems.map((item, i) => (
                  <div key={i} className="oc-item-row">
                    <span>{item.name} × {item.qty}</span>
                    <span>{fmt(item.total ?? (item.price ?? 0) * item.qty)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Link href={`/products?store=${sq}`} className="cd-btn-checkout oc-continue-btn">
          Continue Shopping
        </Link>
      </div>
    </PageShell>
  );
}

// Shared layout shell so all the render branches don't duplicate boilerplate
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Head><title>Your Order</title></Head>
      <Header />
      <main className="sf-container oc-main">
        {children}
      </main>
      <Footer />
    </>
  );
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const { withStore } = await import('../../lib/resolveStore');
  return withStore(ctx);
}
