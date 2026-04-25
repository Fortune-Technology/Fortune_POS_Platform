/**
 * Checkout page — contact info, fulfillment, payment.
 *
 * Card payments use Dejavoo / iPOSpays HPP (Hosted Payment Page).
 * The shopper enters card data on iPOSpays' hosted page (PCI scope is
 * theirs) — we never see the PAN or even a card token here. After payment,
 * iPOSpays redirects back to /order/[id] which polls for payment status.
 *
 * Cash-on-pickup is a standard create-order flow — no redirect.
 */

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import type { GetServerSidePropsContext } from 'next';
import { ShoppingCart as CartEmptyIcon, Store, Truck, CreditCard, Lock, Banknote, ExternalLink } from 'lucide-react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import CartDrawer from '../components/cart/CartDrawer';
import { useCart } from '../lib/cart';
import { useAuth } from '../lib/auth';
import { submitCheckout } from '../lib/api';

function fmt(n: number | string): string {
  return `$${Number(n).toFixed(2)}`;
}

interface CheckoutForm {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfillmentType: 'pickup' | 'delivery';
  street: string;
  city: string;
  state: string;
  zip: string;
  instructions: string;
  notes: string;
}

type PayMethod = 'card' | 'cash_on_pickup';

interface OutOfStockItem {
  posProductId: string;
  quantityOnHand: number;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, cartTotal, sessionId, clearCart, storeSlug } = useCart();
  const { isLoggedIn, customer } = useAuth();

  // Surface the iPOSpays-cancel state if the shopper bailed and returned here.
  const cancelled = router.query.cancelled === '1';

  useEffect(() => {
    if (!isLoggedIn) {
      router.replace(`/account/login?store=${storeSlug}&redirect=/checkout`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  const [form, setForm] = useState<CheckoutForm>({
    customerName:    customer?.name  || '',
    customerEmail:   customer?.email || '',
    customerPhone:   customer?.phone || '',
    fulfillmentType: 'pickup',
    street:          '',
    city:            '',
    state:           '',
    zip:             '',
    instructions:    '',
    notes:           '',
  });

  const [payMethod, setPayMethod] = useState<PayMethod>('card');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(cancelled ? 'Payment was cancelled. You can retry below.' : null);

  const set = (field: keyof CheckoutForm) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.customerName || !form.customerEmail) {
      setError('Name and email are required');
      return;
    }
    if (items.length === 0) {
      setError('Your cart is empty');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const orderData: Record<string, unknown> = {
        sessionId,
        customerName:  form.customerName,
        customerEmail: form.customerEmail,
        customerPhone: form.customerPhone || undefined,
        fulfillmentType: form.fulfillmentType,
        shippingAddress:
          form.fulfillmentType === 'delivery'
            ? {
                street:       form.street,
                city:         form.city,
                state:        form.state,
                zip:          form.zip,
                instructions: form.instructions,
              }
            : undefined,
        paymentMethod: payMethod,
        notes:         form.notes || undefined,
        // Origin so ecom-backend can build the absolute return URL iPOSpays
        // sends the shopper to after payment.
        returnBaseUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
      };

      const result = await submitCheckout(storeSlug, orderData);

      // Card payment → redirect to iPOSpays hosted page (don't clear cart yet —
      // ecom-backend leaves the cart intact until the webhook confirms payment,
      // so the user can retry without re-entering everything).
      if (result.paymentUrl) {
        window.location.href = result.paymentUrl;
        return;
      }

      // Cash on pickup → order is already confirmed, jump to the receipt page
      clearCart();
      router.push(
        `/order/${result.id}?store=${storeSlug}&email=${encodeURIComponent(form.customerEmail)}`
      );
    } catch (err) {
      const axiosErr = err as {
        response?: { data?: { error?: string; outOfStock?: OutOfStockItem[] } };
        message?: string;
      };
      const msg = axiosErr.response?.data?.error || axiosErr.message || 'Something went wrong';
      const outOfStock = axiosErr.response?.data?.outOfStock;
      if (outOfStock) {
        setError(
          `Out of stock: ${outOfStock.map(i => `Product #${i.posProductId} (only ${i.quantityOnHand} left)`).join(', ')}`
        );
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  };

  if (items.length === 0 && !loading) {
    return (
      <>
        <Head><title>Checkout</title></Head>
        <Header />
        <CartDrawer />
        <main className="sf-container">
          <div className="sf-empty ck-empty">
            <div className="sf-empty-icon"><CartEmptyIcon size={48} strokeWidth={1.5} /></div>
            <p>Your cart is empty — add some products first.</p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const canPlaceOrder = !loading && !!form.customerName && !!form.customerEmail
    && (form.fulfillmentType === 'pickup' || (form.street && form.city && form.state && form.zip));

  return (
    <>
      <Head><title>Checkout</title></Head>
      <Header />
      <CartDrawer />

      <main className="sf-container">
        <div className="sf-page-header">
          <h1 className="sf-page-title">Checkout</h1>
        </div>

        <form className="ck-layout" onSubmit={handleSubmit}>
          <div className="ck-form">
            {error && <div className="ck-error">{error}</div>}

            {/* ── Contact ──────────────────────────────────────────────── */}
            <section className="ck-section">
              <h2 className="ck-section-title">Contact Information</h2>
              <div className="ck-field">
                <label className="ck-label">Full Name *</label>
                <input className="ck-input" value={form.customerName} onChange={set('customerName')} required />
              </div>
              <div className="ck-field-row">
                <div className="ck-field">
                  <label className="ck-label">Email *</label>
                  <input className="ck-input" type="email" value={form.customerEmail} onChange={set('customerEmail')} required />
                </div>
                <div className="ck-field">
                  <label className="ck-label">Phone</label>
                  <input className="ck-input" type="tel" value={form.customerPhone} onChange={set('customerPhone')} />
                </div>
              </div>
            </section>

            {/* ── Fulfillment ───────────────────────────────────────────── */}
            <section className="ck-section">
              <h2 className="ck-section-title">Fulfillment</h2>
              <div className="ck-toggle-row">
                <button
                  type="button"
                  className={`ck-toggle-btn ${form.fulfillmentType === 'pickup' ? 'ck-toggle-btn--active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, fulfillmentType: 'pickup' }))}
                >
                  <Store size={16} /> Pickup
                </button>
                <button
                  type="button"
                  className={`ck-toggle-btn ${form.fulfillmentType === 'delivery' ? 'ck-toggle-btn--active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, fulfillmentType: 'delivery' }))}
                >
                  <Truck size={16} /> Delivery
                </button>
              </div>

              {form.fulfillmentType === 'delivery' && (
                <div className="ck-address">
                  <div className="ck-field">
                    <label className="ck-label">Street Address</label>
                    <input className="ck-input" value={form.street} onChange={set('street')} required />
                  </div>
                  <div className="ck-field-row">
                    <div className="ck-field"><label className="ck-label">City</label><input className="ck-input" value={form.city} onChange={set('city')} required /></div>
                    <div className="ck-field"><label className="ck-label">State</label><input className="ck-input" value={form.state} onChange={set('state')} required /></div>
                    <div className="ck-field"><label className="ck-label">ZIP</label><input className="ck-input" value={form.zip} onChange={set('zip')} required /></div>
                  </div>
                  <div className="ck-field">
                    <label className="ck-label">Delivery Instructions</label>
                    <textarea className="ck-input ck-textarea" value={form.instructions} onChange={set('instructions')} rows={2} />
                  </div>
                </div>
              )}
            </section>

            {/* ── Payment ───────────────────────────────────────────────── */}
            <section className="ck-section">
              <h2 className="ck-section-title">Payment</h2>

              <div className="ck-toggle-row">
                <button
                  type="button"
                  className={`ck-toggle-btn ${payMethod === 'card' ? 'ck-toggle-btn--active' : ''}`}
                  onClick={() => setPayMethod('card')}
                >
                  <CreditCard size={16} /> Pay by Card
                </button>
                <button
                  type="button"
                  className={`ck-toggle-btn ${payMethod === 'cash_on_pickup' ? 'ck-toggle-btn--active' : ''}`}
                  onClick={() => setPayMethod('cash_on_pickup')}
                >
                  <Store size={16} /> Pay on Pickup
                </button>
              </div>

              {payMethod === 'card' && (
                <div className="ck-pci-notice">
                  <Lock size={14} />
                  <span>
                    You'll be redirected to a secure payment page to enter your card details.
                    We never see your card number — it goes directly to our PCI-compliant
                    payment processor.
                  </span>
                </div>
              )}

              {payMethod === 'cash_on_pickup' && (
                <div className="ck-cash-notice">
                  <Banknote size={16} /> You'll pay in cash when you pick up your order.
                </div>
              )}
            </section>

            {/* ── Notes ────────────────────────────────────────────────── */}
            <section className="ck-section">
              <h2 className="ck-section-title">Order Notes</h2>
              <div className="ck-field">
                <textarea className="ck-input ck-textarea" placeholder="Any special requests..." value={form.notes} onChange={set('notes')} rows={2} />
              </div>
            </section>
          </div>

          {/* ── Order Summary Sidebar ────────────────────────────────────── */}
          <div className="ck-sidebar">
            <h3 className="sc-summary-title">Order Summary</h3>
            <div className="ck-items-list">
              {items.map(item => (
                <div key={item.productId} className="ck-summary-item">
                  <span className="ck-summary-item-name">{item.name} × {item.qty}</span>
                  <span>{fmt(item.price * item.qty)}</span>
                </div>
              ))}
            </div>
            <div className="sc-summary-row sc-summary-row--mt12">
              <span>Subtotal</span><span>{fmt(cartTotal)}</span>
            </div>
            <div className="sc-summary-row sc-summary-row--muted">
              <span>Tax</span><span>$0.00</span>
            </div>
            {form.fulfillmentType === 'delivery' && (
              <div className="sc-summary-row sc-summary-row--muted">
                <span>Delivery Fee</span><span>$0.00</span>
              </div>
            )}
            <div className="sc-summary-row sc-summary-total">
              <span>Total</span><span>{fmt(cartTotal)}</span>
            </div>

            <button
              type="submit"
              className="cd-btn-checkout ck-submit-btn"
              disabled={!canPlaceOrder}
            >
              {loading
                ? 'Processing...'
                : payMethod === 'card'
                  ? <>Pay {fmt(cartTotal)} <ExternalLink size={14} /></>
                  : 'Place Order'}
            </button>

            {payMethod === 'card' && (
              <div className="ck-secured-by">
                <Lock size={14} /> Secured by Dejavoo / iPOSpays
              </div>
            )}
          </div>
        </form>
      </main>

      <Footer />
    </>
  );
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const { withStore } = await import('../lib/resolveStore');
  return withStore(ctx);
}
