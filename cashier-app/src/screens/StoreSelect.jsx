import React from 'react';
import { Store, ArrowRight, LogOut } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore.js';
import { useNavigate } from 'react-router-dom';
import './StoreSelect.css';

export default function StoreSelect() {
  const { cashier, stores, setStore, logout } = useAuthStore();
  const navigate = useNavigate();

  React.useEffect(() => {
    const storeList = cashier?.stores || stores;
    if (storeList?.length === 1) {
      const s = storeList[0];
      setStore(s.id || s._id);
      navigate('/', { replace: true });
    }
  }, []);

  const handleSelect = (store) => {
    setStore(store.id || store._id);
    navigate('/', { replace: true });
  };

  const storeList = cashier?.stores || stores;

  return (
    <div className="ssel-page">
      <div className="ssel-container">
        <div className="ssel-header">
          <div className="ssel-title">Select Store</div>
          <div className="ssel-subtitle">
            Welcome, {cashier?.name} — choose your location to continue
          </div>
        </div>

        <div className="ssel-list">
          {storeList?.length > 0 ? storeList.map(store => (
            <button
              key={store.id || store._id}
              onClick={() => handleSelect(store)}
              className="ssel-store-btn"
            >
              <div className="ssel-store-inner">
                <div className="ssel-store-icon">
                  <Store size={18} color="var(--green)" />
                </div>
                <div className="ssel-store-info">
                  <div className="ssel-store-name">{store.name}</div>
                  {store.address && (
                    <div className="ssel-store-addr">{store.address}</div>
                  )}
                </div>
              </div>
              <ArrowRight size={16} color="var(--text-muted)" />
            </button>
          )) : (
            <div className="ssel-empty">
              No stores found for your account.<br />
              Set up a store in the portal first.
            </div>
          )}
        </div>

        <button onClick={logout} className="ssel-logout">
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </div>
  );
}
