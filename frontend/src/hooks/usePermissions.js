/**
 * usePermissions — read the current user's effective permission set.
 *
 * Source order:
 *   1. `localStorage.user.permissions` (set on login)
 *   2. Fallback: fetches /api/roles/me/permissions once on mount if missing
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

export function usePermissions() {
  const initial = readUser();
  const [user, setUser]           = useState(initial);
  const [perms, setPerms]         = useState(initial?.permissions || []);
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

  useEffect(() => {
    // If we already have permissions in localStorage skip the fetch
    if (!initial?.permissions) refresh();
  }, [refresh, initial?.permissions]);

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
