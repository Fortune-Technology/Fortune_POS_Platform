import { useEffect, useState, ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getRoutePermission } from '../rbac/routePermissions';
import api from '../services/api';
import Unauthorized from '../pages/Unauthorized';

/**
 * Admin-app permission guard. Since the admin-app only admits superadmins
 * (enforced at /login), the typical case is "pass immediately". The guard
 * is still here so that once custom admin roles are created, they're gated
 * correctly.
 */

interface AdminUser {
  token?: string;
  role?: string;
  permissions?: string[];
  [key: string]: unknown;
}

function readAdminUser(): AdminUser | null {
  try { return JSON.parse(localStorage.getItem('admin_user') || 'null'); } catch { return null; }
}

function writeAdminUser(u: AdminUser): void {
  localStorage.setItem('admin_user', JSON.stringify(u));
}

interface PermissionRouteProps {
  children: ReactNode;
  permission?: string;
}

export default function PermissionRoute({ children, permission }: PermissionRouteProps) {
  const location = useLocation();
  const user = readAdminUser();

  const [perms, setPerms] = useState<string[] | null>(user?.permissions || null);
  const [loading, setLoading] = useState<boolean>(!user?.permissions);

  useEffect(() => {
    if (!user?.token) return;
    if (user?.permissions) { setPerms(user.permissions); return; }
    api.get('/roles/me/permissions')
      .then(r => {
        const list: string[] = r.data.permissions || [];
        setPerms(list);
        const u = readAdminUser();
        if (u) { u.permissions = list; writeAdminUser(u); }
      })
      .catch(() => setPerms([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.token]);

  if (!user || !user.token || user.role !== 'superadmin') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  // Superadmin bypass — matches backend behavior
  if (user.role === 'superadmin') return <>{children}</>;

  if (loading) return null;

  const required = permission ?? getRoutePermission(location.pathname);
  if (!required) return <>{children}</>;
  if (!(perms || []).includes(required)) return <Unauthorized required={required} />;
  return <>{children}</>;
}
