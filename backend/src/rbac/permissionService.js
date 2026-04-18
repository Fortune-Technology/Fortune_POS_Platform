/**
 * Permission service — resolves a user's effective permission set.
 *
 * Sources (union):
 *   1. Legacy `User.role` → maps to the matching built-in system role's permissions
 *   2. Any explicit UserRole rows the user holds (custom or system roles)
 *
 * Cached per-request via `req._perms` to avoid repeat DB hits within a single call.
 */

import prisma from '../config/postgres.js';

/**
 * Return a de-duplicated array of permission keys the user effectively holds.
 */
export async function computeUserPermissions(user) {
  if (!user) return [];

  const roleIds = new Set();

  // 1. Legacy `User.role` column → find the matching role.
  //    Could be a built-in system role (orgId=null) OR a custom role in the
  //    user's org (orgId = user.orgId).
  if (user.role) {
    const match = await prisma.role.findFirst({
      where: {
        key: user.role,
        status: 'active',
        OR: [
          { orgId: null, isSystem: true },
          ...(user.orgId ? [{ orgId: user.orgId }] : []),
        ],
      },
      select: { id: true },
    });
    if (match) roleIds.add(match.id);
  }

  // 2. Explicit UserRole assignments (multi-role stacking)
  const userRoles = await prisma.userRole.findMany({
    where: { userId: user.id },
    select: { roleId: true },
  });
  userRoles.forEach(ur => roleIds.add(ur.roleId));

  if (roleIds.size === 0) return [];

  // 3. Collect all permission keys across those roles
  const rolePerms = await prisma.rolePermission.findMany({
    where: { roleId: { in: [...roleIds] } },
    select: { permission: { select: { key: true } } },
  });

  return [...new Set(rolePerms.map(rp => rp.permission.key))];
}

/**
 * Express middleware factory. Usage:
 *   router.post('/products', protect, requirePermission('products.create'), handler)
 *
 * If the user holds ANY of the supplied permission keys, the request passes.
 * (Use this instead of — or alongside — the legacy `authorize('manager', ...)`.)
 *
 * Superadmins bypass the check automatically.
 */
export function requirePermission(...keys) {
  return async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Not authorized' });
      if (req.user.role === 'superadmin') return next();

      if (!req._perms) {
        req._perms = await computeUserPermissions(req.user);
      }
      const has = keys.some(k => req._perms.includes(k));
      if (!has) {
        return res.status(403).json({ error: `Missing permission: ${keys.join(' or ')}` });
      }
      next();
    } catch (err) { next(err); }
  };
}

/**
 * Boolean helper for use inside controllers (post-`protect`):
 *   if (await userHasPermission(req, 'transactions.manage')) { ... }
 */
export async function userHasPermission(req, key) {
  if (!req.user) return false;
  if (req.user.role === 'superadmin') return true;
  if (!req._perms) req._perms = await computeUserPermissions(req.user);
  return req._perms.includes(key);
}

/**
 * Ensure the user is assigned to the built-in system role that matches their
 * legacy `User.role` field. Idempotent — safe to call on every create/update.
 *
 * Removes ANY stale default-role assignments (other system roles) so that
 * changing User.role from "cashier" to "manager" also updates the UserRole
 * junction. Custom per-org roles assigned manually are never touched.
 *
 * Returns true if a change was made, false if already in sync.
 */
export async function syncUserDefaultRole(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!user || !user.role) return false;

  // Only auto-sync BUILT-IN system roles. For custom org roles set as
  // `user.role`, we rely on `computeUserPermissions` reading the key
  // directly — we don't create an auto-UserRole entry, so that manually
  // stacked custom roles via UserRolesModal aren't silently wiped when
  // the primary role changes.
  const systemRole = await prisma.role.findFirst({
    where: { orgId: null, key: user.role, isSystem: true },
    select: { id: true, key: true },
  });

  // Always clean up stale built-in system UserRoles (from a previous `user.role`).
  const existing = await prisma.userRole.findMany({
    where: {
      userId,
      role: { isSystem: true, orgId: null },
    },
    select: { roleId: true },
  });

  const targetId = systemRole?.id;
  const alreadyAssigned = targetId ? existing.some(e => e.roleId === targetId) : false;
  const staleIds = existing
    .filter(e => e.roleId !== targetId)
    .map(e => e.roleId);

  let changed = false;

  if (staleIds.length) {
    await prisma.userRole.deleteMany({ where: { userId, roleId: { in: staleIds } } });
    changed = true;
  }

  if (targetId && !alreadyAssigned) {
    await prisma.userRole.create({ data: { userId, roleId: targetId } });
    changed = true;
  }

  return changed;
}

export default { computeUserPermissions, requirePermission, userHasPermission, syncUserDefaultRole };
