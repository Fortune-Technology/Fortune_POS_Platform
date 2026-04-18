/**
 * usePermissions — read the current user's effective permission set.
 *
 * Pattern: stale-while-revalidate.
 *   • Render immediately from `localStorage.user.permissions` (if present)
 *   • Always re-fetch `/api/roles/me/permissions` on mount in the background
 *   • Also re-fetch when the tab regains visibility (someone had it open
 *     during a deploy), and once every 5 minutes (belt-and-suspenders for
 *     long-lived tabs after an admin changes the user's role).
 *
 * Before: if the cache was populated once (even with a stale/partial set),
 * the hook skipped the network call forever and left the user stranded with
 * out-of-date permissions. That's how the "Unauthorized Access" bug bit an
 * owner after the RBAC seed ran on the backend.
 *
 * Superadmins bypass all checks (they always return `true`).
 */

import { useEffect, useState, useCallback } from 'react';
import { getMyPermissions } from '../services/api';

function readUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
}

function writeUser(u) {
  localStorage.setItem('user', JSON.stringify(u));
}

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 min

export function usePermissions() {
  const initial = readUser();
  const [user, setUser]           = useState(initial);
  const [perms, setPerms]         = useState(initial?.permissions || []);
  // `loading` only matters on first render when there's no cache at all.
  const [loading, setLoading]     = useState(!initial?.permissions);

  const refresh = useCallback(async () => {
    try {
      const data = await getMyPermissions();
      setPerms(data.permissions || []);
      const current = readUser();
      if (current) {
        current.permissions = data.permissions || [];
        writeUser(current);
        setUser(current);
      }
    } catch {/* stay silent */}
    finally { setLoading(false); }
  }, []);

  // Always revalidate on mount — cache is hydration fuel, not the source of truth.
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [refresh]);

  const can = useCallback((key) => {
    if (!user) return false;
    if (user.role === 'superadmin') return true;
    if (!key) return true;
    if (Array.isArray(key)) return key.some(k => perms.includes(k));
    return perms.includes(key);
  }, [user, perms]);

  const canAny = useCallback((keys) => keys.some(k => can(k)), [can]);
  const canAll = useCallback((keys) => keys.every(k => can(k)), [can]);

  return { user, permissions: perms, can, canAny, canAll, refresh, loading };
}

/**
 * <Can permission="products.edit">…</Can>
 * <Can anyOf={['products.edit','products.create']}>…</Can>
 * <Can allOf={['products.edit','products.delete']}>…</Can>
 * Pass `fallback` to render something in place of a denied child.
 */
export function Can({ permission, anyOf, allOf, fallback = null, children }) {
  const { can, canAny, canAll } = usePermissions();
  let ok = true;
  if (permission) ok = can(permission);
  else if (anyOf) ok = canAny(anyOf);
  else if (allOf) ok = canAll(allOf);
  return ok ? children : fallback;
}

export default usePermissions;
