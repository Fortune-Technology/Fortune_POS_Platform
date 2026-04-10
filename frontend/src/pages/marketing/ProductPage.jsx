import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import './ProductPage.css';

export default function ProductPage() {
  const { slug }   = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty]         = useState(1);
  const [added, setAdded]     = useState(false);

  useEffect(() => {
    fetch(`/api/equipment/products/${slug}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setProduct(data))
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [slug]);

  const addToCart = () => {
    const cart     = JSON.parse(localStorage.getItem('storv_cart') || '[]');
    const existing = cart.find(i => i.productId === product.id);
    if (existing) {
      existing.qty += qty;
    } else {
      cart.push({
        productId: product.id,
        name:      product.name,
        price:     Number(product.price),
        qty,
        image:     product.images?.[0] || null,
      });
    }
    localStorage.setItem('storv_cart', JSON.stringify(cart));
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  };

  const fmt = (n) => `$${Number(n).toFixed(2)}`;
  const isOutOfStock = product?.trackStock && product.stockQty === 0;

  if (loading) return (
    <div className="mpp-center">Loading...</div>
  );

  if (!product) return (
    <div className="mpp-center">
      <p>Product not found.</p>
      <Link to="/shop" className="mpp-center-link">← Back to Shop</Link>
    </div>
  );

  const addBtnClass = added
    ? 'mpp-add-btn mpp-add-btn--added'
    : isOutOfStock
      ? 'mpp-add-btn mpp-add-btn--oos'
      : 'mpp-add-btn mpp-add-btn--default';

  return (
    <div className="mpp-page">
      <header className="mpp-header">
        <Link to="/shop" className="mpp-back-link">← Back to Shop</Link>
        <Link to="/shop/cart" className="mpp-cart-link">🛒 Cart</Link>
      </header>

      <div className="mpp-grid">
        {/* Image */}
        <div className="mpp-image-wrap">
          {product.images?.[0]
            ? <img src={product.images[0]} alt={product.name} />
            : <span className="mpp-image-placeholder">🖥️</span>}
        </div>

        {/* Info */}
        <div>
          <div className="mpp-category">{product.category}</div>
          <h1 className="mpp-name">{product.name}</h1>
          <div className="mpp-price">{fmt(product.price)}</div>
          <p className="mpp-description">{product.description}</p>

          {/* Specs */}
          {product.specs && Object.keys(product.specs).length > 0 && (
            <div className="mpp-specs">
              <h3 className="mpp-specs-title">Specifications</h3>
              <div className="mpp-specs-grid">
                {Object.entries(product.specs).map(([k, v]) => (
                  <div key={k} className="mpp-spec-item">
                    <div className="mpp-spec-label">{k}</div>
                    <div className="mpp-spec-value">{String(v)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Qty + Add to Cart */}
          <div className="mpp-actions">
            <div className="mpp-qty-wrap">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} className="mpp-qty-btn">−</button>
              <span className="mpp-qty-val">{qty}</span>
              <button onClick={() => setQty(q => q + 1)} className="mpp-qty-btn">+</button>
            </div>
            <button
              onClick={addToCart}
              disabled={isOutOfStock}
              className={addBtnClass}
            >
              {added ? '✓ Added to Cart' : isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
            </button>
          </div>

          <Link to="/shop/cart" className="mpp-view-cart">View Cart →</Link>

          {product.trackStock && (
            <p className={`mpp-stock ${product.stockQty > 0 ? 'mpp-stock--in' : 'mpp-stock--out'}`}>
              {product.stockQty > 0 ? `${product.stockQty} in stock` : 'Out of stock'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
