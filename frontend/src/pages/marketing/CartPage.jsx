import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './CartPage.css';

const FREE_SHIPPING_THRESHOLD = 500;
const FLAT_SHIPPING = 25;

export default function CartPage() {
  const navigate = useNavigate();
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem('storv_cart') || '[]'); } catch { return []; }
  });

  const save = (updated) => {
    setCart(updated);
    localStorage.setItem('storv_cart', JSON.stringify(updated));
  };

  const updateQty = (productId, delta) => {
    save(cart.map(i => i.productId === productId ? { ...i, qty: Math.max(1, i.qty + delta) } : i));
  };

  const remove = (productId) => save(cart.filter(i => i.productId !== productId));

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const shipping  = subtotal > 0 ? (subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING) : 0;
  const total     = subtotal + shipping;
  const fmt = (n) => `$${Number(n).toFixed(2)}`;

  return (
    <div className="mcp-page">
      <header className="mcp-header">
        <Link to="/shop" className="mcp-back-link">← Continue Shopping</Link>
        <h1 className="mcp-heading">Your Cart</h1>
        <div className="mcp-spacer" />
      </header>

      <div className="mcp-content">
        {cart.length === 0 ? (
          <div className="mcp-empty">
            <div className="mcp-empty-icon">🛒</div>
            <p className="mcp-empty-text">Your cart is empty.</p>
            <Link to="/shop" className="mcp-empty-link">Browse products →</Link>
          </div>
        ) : (
          <>
            {/* Cart items */}
            <div className="mcp-items">
              {cart.map(item => (
                <div key={item.productId} className="mcp-item">
                  {/* Thumbnail */}
                  <div className="mcp-thumb">
                    {item.image
                      ? <img src={item.image} alt={item.name} />
                      : <div className="mcp-thumb-placeholder">🖥️</div>}
                  </div>

                  {/* Name + price */}
                  <div className="mcp-item-info">
                    <div className="mcp-item-name">{item.name}</div>
                    <div className="mcp-item-price">{fmt(item.price)} each</div>
                  </div>

                  {/* Qty controls */}
                  <div className="mcp-qty">
                    <button onClick={() => updateQty(item.productId, -1)} className="mcp-qty-btn">−</button>
                    <span className="mcp-qty-val">{item.qty}</span>
                    <button onClick={() => updateQty(item.productId, 1)} className="mcp-qty-btn">+</button>
                  </div>

                  {/* Line total */}
                  <div className="mcp-line-total">{fmt(item.price * item.qty)}</div>

                  {/* Remove */}
                  <button onClick={() => remove(item.productId)} className="mcp-remove-btn">✕</button>
                </div>
              ))}
            </div>

            {/* Order summary */}
            <div className="mcp-summary">
              {[
                { label: 'Subtotal', value: fmt(subtotal) },
                {
                  label: `Shipping${subtotal >= FREE_SHIPPING_THRESHOLD ? ' (free over $500)' : ' (flat rate)'}`,
                  value: shipping === 0 ? 'FREE' : fmt(shipping),
                },
              ].map(({ label, value }) => (
                <div key={label} className="mcp-summary-row">
                  <span>{label}</span><span>{value}</span>
                </div>
              ))}

              <hr className="mcp-divider" />

              <div className="mcp-total-row">
                <span>Total</span><span>{fmt(total)}</span>
              </div>

              <button onClick={() => navigate('/shop/checkout')} className="mcp-checkout-btn">
                Proceed to Checkout →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
