/**
 * CategoryPanel — Left pane content below the search bar.
 * Shows category pills -> product grid for selected category.
 * Shows quick-add tiles (top scanned products) when no category selected.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { X, ShoppingBag } from 'lucide-react';
import { getDepartments, getProductsByDepartment, getFrequentProducts } from '../../db/dexie.js';
import { fmt$ } from '../../utils/formatters.js';
import './CategoryPanel.css';

// ── Single product tile ────────────────────────────────────────────────────
function ProductTile({ product, onAdd, size = 'md' }) {
  return (
    <button
      onTouchEnd={(e) => { e.preventDefault(); onAdd(product); }}
      onClick={() => onAdd(product)}
      className={`cp-tile ${size === 'lg' ? 'cp-tile--lg' : 'cp-tile--md'}`}
    >
      <div className="cp-tile-name">{product.name}</div>
      <div className="cp-tile-footer">
        <span className="cp-tile-price">{fmt$(product.retailPrice)}</span>
        <div className="cp-tile-badges">
          {product.ebtEligible && (
            <span className="cp-tile-badge cp-tile-badge--ebt">EBT</span>
          )}
          {product.ageRequired && (
            <span className="cp-tile-badge cp-tile-badge--age">{product.ageRequired}+</span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Empty state ──
function EmptyState() {
  return (
    <div className="cp-empty--full">
      <ShoppingBag size={48} />
      <div className="cp-empty-text">Scan or search to add items</div>
    </div>
  );
}

// ── Main CategoryPanel ─────────────────────────────────────────────────────
export default function CategoryPanel({ onAddProduct, config = {} }) {
  const showDepts = config.showDepartments !== false;
  const showQuick = config.showQuickAdd    !== false;

  const [departments,   setDepartments]   = useState([]);
  const [activeDeptId,  setActiveDeptId]  = useState(null);
  const [categoryItems, setCategoryItems] = useState([]);
  const [quickItems,    setQuickItems]    = useState([]);
  const [loadingCat,    setLoadingCat]    = useState(false);

  useEffect(() => {
    if (showDepts) {
      getDepartments().then(all => {
        const hidden = config.hiddenDepartments || [];
        const visible = all.filter(d => {
          const name = typeof d === 'string' ? d : (d.name || d.id || String(d));
          if (hidden.includes(name)) return false;
          if (typeof d === 'object' && d.showInPOS === false) return false;
          return true;
        });
        setDepartments(visible);
      });
    }
    if (showQuick) getFrequentProducts(12).then(setQuickItems);
  }, [showDepts, showQuick, config.hiddenDepartments]);

  const selectDept = useCallback(async (deptId) => {
    if (deptId === activeDeptId) { setActiveDeptId(null); setCategoryItems([]); return; }
    setActiveDeptId(deptId);
    setLoadingCat(true);
    const items = await getProductsByDepartment(deptId, 60);
    setCategoryItems(items);
    setLoadingCat(false);
  }, [activeDeptId]);

  if (!showDepts && !showQuick) {
    return (
      <div className="cp-wrap">
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="cp-wrap">
      {/* Category pills */}
      {showDepts && departments.length > 0 && (
        <div className="cp-pills">
          {departments.map(d => (
            <button
              key={d.id}
              onClick={() => selectDept(d.id)}
              className={`cp-pill ${activeDeptId === d.id ? 'cp-pill--active' : 'cp-pill--inactive'}`}
            >
              {d.name}
            </button>
          ))}
          {activeDeptId && (
            <button
              onClick={() => { setActiveDeptId(null); setCategoryItems([]); }}
              className="cp-pill-clear"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* Content area */}
      <div className="cp-content scroll">
        {/* Category product grid */}
        {showDepts && activeDeptId && (
          <>
            {loadingCat ? (
              <div className="cp-msg">Loading\u2026</div>
            ) : categoryItems.length === 0 ? (
              <div className="cp-msg">No products in this category yet.</div>
            ) : (
              <div className="cp-grid">
                {categoryItems.map(p => (
                  <ProductTile key={p.id} product={p} onAdd={onAddProduct} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Quick-add grid */}
        {(!showDepts || !activeDeptId) && showQuick && (
          <>
            {quickItems.length > 0 ? (
              <>
                <div className="cp-quick-label">QUICK ADD</div>
                <div className="cp-grid">
                  {quickItems.map(p => (
                    <ProductTile key={p.id} product={p} onAdd={onAddProduct} size="lg" />
                  ))}
                </div>
              </>
            ) : (
              <div className="cp-empty">
                <ShoppingBag size={56} />
                <div className="cp-empty-text">Scan or search to add items</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
