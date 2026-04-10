import React, { useState, useEffect, useRef } from 'react';
import { Tag, Search, X, Plus, AlertCircle } from 'lucide-react';
import { useCartStore } from '../../stores/useCartStore.js';
import { useProductLookup } from '../../hooks/useProductLookup.js';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner.js';
import { searchProducts } from '../../db/dexie.js';
import { fmt$ } from '../../utils/formatters.js';
import './PriceCheckModal.css';

export default function PriceCheckModal({ onClose }) {
  const addProduct    = useCartStore(s => s.addProduct);
  const requestAge    = useCartStore(s => s.requestAgeVerify);
  const { lookup }    = useProductLookup();

  const [query,    setQuery]   = useState('');
  const [product,  setProduct] = useState(null);
  const [results,  setResults] = useState([]);
  const [notFound, setNotFound]= useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useBarcodeScanner(async (raw) => {
    const { product: p } = await lookup(raw);
    if (p) { setProduct(p); setNotFound(false); setResults([]); }
    else   { setProduct(null); setNotFound(true); }
  }, true);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setNotFound(false); return; }
    const t = setTimeout(() => {
      searchProducts(query, null).then(r => { setResults(r); setNotFound(r.length === 0); });
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const addToCart = (p) => {
    if (p.ageRequired) requestAge(p);
    else addProduct(p);
    onClose();
  };

  return (
    <div className="pcm-backdrop">
      <div className="pcm-modal">
        <div className="pcm-header">
          <Tag size={18} color="var(--green)" />
          <div className="pcm-header-title">Price Check</div>
          <button className="pcm-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="pcm-body">
          <div className="pcm-search-wrap">
            <Search size={15} color="var(--text-muted)" className="pcm-search-icon" />
            <input
              ref={inputRef}
              className="pcm-search-input"
              value={query}
              onChange={e => { setQuery(e.target.value); setProduct(null); }}
              placeholder="Search or scan barcode..."
            />
          </div>

          {/* Product result */}
          {product && (
            <div className="pcm-product-card">
              <div className="pcm-product-name">{product.name}</div>
              {product.brand && <div className="pcm-product-brand">{product.brand}</div>}
              <div className="pcm-product-price">{fmt$(product.retailPrice)}</div>
              <div className="pcm-product-badges">
                {product.ebtEligible && <span className="pcm-badge pcm-badge--ebt">EBT</span>}
                {product.ageRequired && <span className="pcm-badge pcm-badge--age">{product.ageRequired}+</span>}
                {!product.taxable && <span className="pcm-badge pcm-badge--notax">No Tax</span>}
              </div>
              <button className="pcm-add-btn" onClick={() => addToCart(product)}>
                <Plus size={16} /> Add to Cart
              </button>
            </div>
          )}

          {/* Search results list */}
          {!product && results.length > 0 && (
            <div className="pcm-results">
              {results.map(p => (
                <button key={p.id} className="pcm-result-row" onClick={() => setProduct(p)}>
                  <div>
                    <div className="pcm-result-name">{p.name}</div>
                    <div className="pcm-result-upc">{p.upc}</div>
                  </div>
                  <span className="pcm-result-price">{fmt$(p.retailPrice)}</span>
                </button>
              ))}
            </div>
          )}

          {notFound && (
            <div className="pcm-not-found">
              <AlertCircle size={32} className="pcm-not-found-icon" />
              <div className="pcm-not-found-text">Product not found</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
