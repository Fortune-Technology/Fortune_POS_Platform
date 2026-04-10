import React, { useState, useEffect } from 'react';
import { PauseCircle, Play, Trash2, X, ShoppingCart, Tag } from 'lucide-react';
import { useCartStore } from '../../stores/useCartStore.js';
import { getHeldTransactions, deleteHeldTransaction } from '../../db/dexie.js';
import { fmt$ } from '../../utils/formatters.js';
import './HoldRecallModal.css';

export default function HoldRecallModal({ onClose }) {
  const items       = useCartStore(s => s.items);
  const holdCart    = useCartStore(s => s.holdCart);
  const recallHeld  = useCartStore(s => s.recallHeld);

  const [held,      setHeld]     = useState([]);
  const [loading,   setLoading]  = useState(true);
  const [confirm,   setConfirm]  = useState(null);
  const [holdLabel, setHoldLabel] = useState('');

  const load = () => getHeldTransactions().then(setHeld).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const doHold = async () => {
    await holdCart(holdLabel.trim());
    onClose();
  };

  const doRecall = async (id) => {
    if (items.length > 0 && confirm !== id) { setConfirm(id); return; }
    await recallHeld(id);
    onClose();
  };

  const doDelete = async (id) => {
    await deleteHeldTransaction(id);
    load();
  };

  return (
    <div className="hrm-backdrop">
      <div className="hrm-modal">
        {/* Header */}
        <div className="hrm-header">
          <PauseCircle size={18} color="var(--blue)" />
          <div className="hrm-header-info">
            <div className="hrm-header-title">Hold &amp; Recall</div>
            <div className="hrm-header-sub">Park transactions and pick them back up</div>
          </div>
          <button className="hrm-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Hold current cart button */}
        {items.length > 0 && (
          <div className="hrm-hold-section">
            <div className="hrm-hold-label-row">
              <Tag size={13} color="var(--text-muted)" className="hrm-hold-label-icon" />
              <input
                className="hrm-hold-input"
                value={holdLabel}
                onChange={e => setHoldLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doHold()}
                placeholder="Label (optional) — e.g. Table 4, Jane"
                maxLength={40}
              />
            </div>
            <button className="hrm-hold-btn" onClick={doHold}>
              <PauseCircle size={16} />
              Hold Current Cart ({items.length} item{items.length !== 1 ? 's' : ''})
            </button>
          </div>
        )}

        {/* Held transactions list */}
        <div className="hrm-list">
          {loading ? (
            <div className="hrm-loading">Loading...</div>
          ) : held.length === 0 ? (
            <div className="hrm-empty">
              <ShoppingCart size={40} className="hrm-empty-icon" />
              <div className="hrm-empty-text">No held transactions</div>
            </div>
          ) : (
            held.map(h => {
              const total = (h.items || []).reduce((s, i) => s + i.lineTotal, 0);
              const time  = new Date(h.heldAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={h.id} className="hrm-held-row">
                  <div className="hrm-held-info">
                    <div className="hrm-held-name">{h.label || 'Held Transaction'}</div>
                    <div className="hrm-held-meta">{(h.items || []).length} items - {time}</div>
                  </div>
                  <div className="hrm-held-total">{fmt$(total)}</div>
                  {confirm === h.id ? (
                    <div className="hrm-confirm-actions">
                      <button className="hrm-btn-confirm-recall" onClick={() => doRecall(h.id)}>Recall &amp; clear cart</button>
                      <button className="hrm-btn-confirm-cancel" onClick={() => setConfirm(null)}>Cancel</button>
                    </div>
                  ) : (
                    <div className="hrm-held-actions">
                      <button className="hrm-btn-recall" onClick={() => doRecall(h.id)}>
                        <Play size={14} />
                      </button>
                      <button className="hrm-btn-delete" onClick={() => doDelete(h.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
