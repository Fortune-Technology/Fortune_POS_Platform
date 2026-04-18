import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { getRoutePermission } from '../rbac/routePermissions';
import Unauthorized from '../pages/Unauthorized';

/**
 * Guards a route based on the caller's effective permissions.
 *
 * Layered checks (in order):
 *   1. Not logged in  → redirect to /login
 *   2. Permission known but not granted → show <Unauthorized />
 *   3. Otherwise render children
 *
 * Explicit `permission` prop overrides the lookup.
 * If no permission is mapped and no prop is provided, the route is
 * "authenticated only" — any logged-in user passes.
 */
export default function PermissionRoute({ children, permission }) {
  const { user, can, loading } = usePermissions();
  const location = useLocation();

  if (!user || !user.token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Wait for permissions fetch before deciding (prevents a false negative flash)
  if (loading) return null;

  const required = permission ?? getRoutePermission(location.pathname);

  // No permission mapped → authenticated-only. Allow.
  if (!required) return children;

  if (!can(required)) {
    return <Unauthorized required={required} />;
  }

  return children;
}
