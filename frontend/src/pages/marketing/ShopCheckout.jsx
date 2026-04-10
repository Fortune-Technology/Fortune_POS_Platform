import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './ShopCheckout.css';

const FREE_SHIPPING_THRESHOLD = 500;
const FLAT_SHIPPING = 25;

// CardSecure tokenizer iframe URL — swap to production URL when going live
const CARDSECURE_URL = 'https://fts-uat.cardpointe.com/itoke/ajax-tokenizer.html';
const IFRAME_PARAMS  = [
  'useexpiry=true',
  'usecvv=true',
  'invalidinputevent=true',
  'tokenizewheninactive=true',
  'inactivityto=500',
  'css=body%7Bbackground%3A%23111827%3Bfont-family%3Asystem-ui%7Dinput%7Bbackground%3A%23111827%3Bborder%3A1px+solid+%23374151%3Bcolor%3A%23e5e7eb%3Bborder-radius%3A8px%3Bpadding%3A10px%3Bfont-size%3A14px%7Dlabel%7Bcolor%3A%239ca3af%3Bfont-size%3A12px%7D',
].join('&');

export default function ShopCheckout() {
  const navigate  = useNavigate();
  const [cart]    = useState(() => { try { return JSON.parse(localStorage.getItem('storv_cart') || '[]'); } catch { return []; } });
  const [token,   setToken]      = useState('');
  const [masked,  setMasked]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,   setError]      = useState('');
  const [form,    setForm]       = useState({
    name: '', email: '', phone: '',
    street: '', city: '', state: '', zip: '',
  });

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const shipping  = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
  const total     = subtotal + shipping;
  const fmt = (n) => `$${Number(n).toFixed(2)}`;

  // Listen for CardSecure postMessage with token
  useEffect(() => {
    const handler = (e) => {
      if (typeof e.data !== 'string') return;
      try {
        const data = JSON.parse(e.data);
        if (data.token) {
          setToken(data.token);
          setMasked(data.maskedCard || data.token.slice(-4) || '');
        }
      } catch {}
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!token) { setError('Please enter your card details above.'); return; }
    if (cart.length === 0) { setError('Your cart is empty.'); return; }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/equipment/orders', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items:           cart.map(i => ({ productId: i.productId, qty: i.qty })),
          customer:        { name: form.name, email: form.email, phone: form.phone || null },
          shippingAddress: { street: form.street, city: form.city, state: form.state, zip: form.zip },
          paymentToken:    token,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Order failed');

      localStorage.removeItem('storv_cart');
      navigate(`/shop/order-confirm?order=${data.orderNumber}`);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (cart.length === 0) return (
    <div className="msc-empty">
      <p>Your cart is empty.</p>
      <Link to="/shop" className="msc-empty-link">Browse products</Link>
    </div>
  );

  return (
    <div className="msc-page">
      <header className="msc-header">
        <Link to="/shop/cart" className="msc-back-link">← Back to Cart</Link>
        <h1 className="msc-heading">Checkout</h1>
      </header>

      <form onSubmit={submit} className="msc-form">
        {/* Left column */}
        <div>
          {/* Contact */}
          <div className="msc-section">
            <h2 className="msc-section-title">Contact Information</h2>
            <div className="msc-field-grid">
              <div className="msc-field-full">
                <label className="msc-label">Full Name *</label>
                <input required className="msc-input" value={form.name} onChange={set('name')} />
              </div>
              <div>
                <label className="msc-label">Email *</label>
                <input required type="email" className="msc-input" value={form.email} onChange={set('email')} />
              </div>
              <div>
                <label className="msc-label">Phone</label>
                <input className="msc-input" value={form.phone} onChange={set('phone')} />
              </div>
            </div>
          </div>

          {/* Shipping */}
          <div className="msc-section">
            <h2 className="msc-section-title">Shipping Address</h2>
            <div className="msc-field-grid">
              <div className="msc-field-full">
                <label className="msc-label">Street Address *</label>
                <input required className="msc-input" value={form.street} onChange={set('street')} />
              </div>
              <div>
                <label className="msc-label">City *</label>
                <input required className="msc-input" value={form.city} onChange={set('city')} />
              </div>
              <div className="msc-state-zip">
                <div>
                  <label className="msc-label">State *</label>
                  <input required maxLength={2} placeholder="ME" className="msc-input" value={form.state} onChange={set('state')} />
                </div>
                <div>
                  <label className="msc-label">ZIP *</label>
                  <input required className="msc-input" value={form.zip} onChange={set('zip')} />
                </div>
              </div>
            </div>
          </div>

          {/* Payment */}
          <div className="msc-section">
            <h2 className="msc-section-title">Payment</h2>
            <p className="msc-payment-note">
              Card details are securely tokenized by CardPointe — we never see your card number.
            </p>

            {token ? (
              <div className="msc-card-captured">
                <span>✓ Card captured{masked ? ` — ···${masked.slice(-4)}` : ''}</span>
                <button
                  type="button"
                  onClick={() => { setToken(''); setMasked(''); }}
                  className="msc-change-btn"
                >
                  Change
                </button>
              </div>
            ) : (
              <iframe
                src={`${CARDSECURE_URL}?${IFRAME_PARAMS}`}
                className="msc-iframe"
                title="Secure Card Entry"
              />
            )}
          </div>

          {error && <div className="msc-error">{error}</div>}

          <button
            type="submit"
            disabled={submitting}
            className={`msc-submit-btn ${submitting ? 'msc-submit-btn--disabled' : 'msc-submit-btn--active'}`}
          >
            {submitting ? 'Processing...' : `Place Order — ${fmt(total)}`}
          </button>
        </div>

        {/* Right: Order summary (sticky) */}
        <div className="msc-summary">
          <h2 className="msc-summary-title">Order Summary</h2>

          {cart.map(item => (
            <div key={item.productId} className="msc-summary-item">
              <div className="msc-summary-item-info">
                <div className="msc-summary-item-name">{item.name}</div>
                <div className="msc-summary-item-qty">Qty: {item.qty}</div>
              </div>
              <div className="msc-summary-item-total">{fmt(item.price * item.qty)}</div>
            </div>
          ))}

          <hr className="msc-divider" />

          {[
            { label: 'Subtotal', value: fmt(subtotal), free: false },
            { label: 'Shipping', value: shipping === 0 ? 'FREE' : fmt(shipping), free: shipping === 0 },
          ].map(({ label: l, value: v, free }) => (
            <div key={l} className="msc-summary-row">
              <span>{l}</span><span className={free ? 'msc-summary-free' : ''}>{v}</span>
            </div>
          ))}

          <hr className="msc-divider-sm" />

          <div className="msc-total-row">
            <span>Total</span><span>{fmt(total)}</span>
          </div>

          {subtotal < FREE_SHIPPING_THRESHOLD && subtotal > 0 && (
            <p className="msc-shipping-hint">
              Add {fmt(FREE_SHIPPING_THRESHOLD - subtotal)} more for free shipping.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
