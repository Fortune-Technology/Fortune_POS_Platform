import React, { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, RefreshCw, User, Clock, LogOut, Database, AlertTriangle } from 'lucide-react';
import StoreveuLogo from '../StoreveuLogo.jsx';
import { useAuthStore }    from '../../stores/useAuthStore.js';
import { useStationStore } from '../../stores/useStationStore.js';
import { useSyncStore }    from '../../stores/useSyncStore.js';
import { useCartStore }    from '../../stores/useCartStore.js';
import { fmtTime }         from '../../utils/formatters.js';
import { countCachedProducts } from '../../db/dexie.js';
import './StatusBar.css';

/** How many minutes ago was the last catalog sync (rounded) */
function fmtSyncAge(isoStr) {
  if (!isoStr) return null;
  const mins = Math.floor((Date.now() - new Date(isoStr).getTime()) / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export default function StatusBar({ onRefresh }) {
  const cashier  = useAuthStore(s => s.cashier);
  const logout   = useAuthStore(s => s.logout);
  const station  = useStationStore(s => s.station);
  const { isOnline, isSyncing, pendingCount, catalogSyncing, catalogSyncedAt, syncError, clearSyncError } = useSyncStore();
  const txNumber = useCartStore(s => s.txNumber);
  const cartItemCount = useCartStore(s => s.items.length);
  const checkLogout   = useAuthStore(s => s.checkLogout);

  const [time,          setTime]          = useState(fmtTime());
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [blockMsg,      setBlockMsg]      = useState('');
  const [syncAge,       setSyncAge]       = useState(fmtSyncAge(catalogSyncedAt));
  const [productCount,  setProductCount]  = useState(null);
  const resetTimer = useRef(null);

  // Count cached products for offline indicator
  useEffect(() => {
    countCachedProducts().then(setProductCount).catch(() => {});
  }, [catalogSyncedAt]);

  // Auto-enter fullscreen when logged in
  useEffect(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  // Clock — update every 10 s
  useEffect(() => {
    const id = setInterval(() => setTime(fmtTime()), 10_000);
    return () => clearInterval(id);
  }, []);

  // "X min ago" label — update every 30 s
  useEffect(() => {
    setSyncAge(fmtSyncAge(catalogSyncedAt));
    const id = setInterval(() => setSyncAge(fmtSyncAge(catalogSyncedAt)), 30_000);
    return () => clearInterval(id);
  }, [catalogSyncedAt]);

  // Two-tap logout: first tap arms it (3 s window), second tap fires
  const handleLogout = async () => {
    const check = checkLogout(cartItemCount);
    if (!check.allowed) {
      setBlockMsg(check.reason);
      setTimeout(() => setBlockMsg(''), 3000);
      return;
    }
    if (!confirmLogout) {
      setConfirmLogout(true);
      resetTimer.current = setTimeout(() => setConfirmLogout(false), 3000);
      return;
    }
    clearTimeout(resetTimer.current);
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    }
    logout();
  };

  return (
    <div className="sb-bar">
      {/* Brand / Store name */}
      <div className="sb-brand">
        <StoreveuLogo iconOnly={true} height={28} darkMode={true} />
        <span className="sb-store-name">
          {station?.storeName || 'Storeveu POS'}
        </span>
      </div>
      {station?.stationName && (
        <span className="sb-station-name">{station.stationName}</span>
      )}

      <div className="sb-divider" />

      {/* Online status + cached product count */}
      <div className="sb-online-status">
        {isOnline
          ? <Wifi size={12} color="var(--green)" />
          : <WifiOff size={12} color="var(--red)" />}
        <span className={isOnline ? 'sb-online-label--on' : 'sb-online-label--off'}>
          {isOnline ? 'ONLINE' : 'OFFLINE'}
        </span>
        {productCount !== null && (
          <span className="sb-product-count">
            <Database size={10} />
            {productCount.toLocaleString()}
          </span>
        )}
      </div>

      {/* Catalog Refresh button */}
      {isOnline && onRefresh && (
        <button
          onClick={catalogSyncing ? undefined : onRefresh}
          disabled={catalogSyncing}
          title={catalogSyncing ? 'Syncing catalog\u2026' : `Refresh catalog${syncAge ? ` \u00B7 last synced ${syncAge}` : ''}`}
          className={`sb-refresh-btn ${catalogSyncing ? 'sb-refresh-btn--syncing' : ''}`}
        >
          <RefreshCw
            size={11}
            style={catalogSyncing ? { animation: 'spin 0.9s linear infinite' } : undefined}
          />
          {catalogSyncing ? 'Syncing\u2026' : syncAge ? `Synced ${syncAge}` : 'Refresh'}
        </button>
      )}

      {/* Pending tx-queue badge */}
      {pendingCount > 0 && (
        <div className="sb-pending">
          <RefreshCw size={11} color="var(--amber)"
            style={isSyncing ? { animation: 'spin 1s linear infinite' } : undefined} />
          <span>
            {pendingCount} pending{isSyncing ? '\u2026' : ''}
          </span>
        </div>
      )}

      {/* Spacer */}
      <div className="sb-spacer" />

      {/* TX Number */}
      {txNumber && (
        <span className="sb-tx-number">{txNumber}</span>
      )}

      {/* Cashier name */}
      {cashier && (
        <div className={`sb-cashier ${cashier.offlineMode ? 'sb-cashier--offline' : 'sb-cashier--online'}`}>
          <User size={12} color={cashier.offlineMode ? 'var(--amber)' : 'var(--text-muted)'} />
          <span>{cashier.name || cashier.email}</span>
          {cashier.offlineMode && (
            <span className="sb-cashier-offline-tag">(offline)</span>
          )}
        </div>
      )}

      {/* Clock */}
      <div className="sb-clock">
        <Clock size={12} />
        <span>{time}</span>
      </div>

      {/* Logout button — two-tap confirm */}
      <button
        onClick={handleLogout}
        title="Sign out"
        className={`sb-logout-btn ${confirmLogout ? 'sb-logout-btn--confirm' : ''}`}
      >
        <LogOut size={12} />
        {confirmLogout ? 'Tap again to sign out' : 'Sign out'}
      </button>

      {/* Sign-out blocked warning */}
      {blockMsg && (
        <div className="sb-warning">{blockMsg}</div>
      )}

      {/* Offline mode warning */}
      {!isOnline && (
        <div className="sb-warning">
          <AlertTriangle size={10} />
          OFFLINE — Sales queued, will sync on reconnect
        </div>
      )}

      {/* Auth-expired warning */}
      {isOnline && syncError === 'auth_expired' && pendingCount > 0 && (
        <div
          onClick={clearSyncError}
          title="Click to dismiss"
          className="sb-warning sb-warning--amber"
        >
          <AlertTriangle size={10} />
          Session expired — sign out and log in again to sync {pendingCount} pending sale{pendingCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
