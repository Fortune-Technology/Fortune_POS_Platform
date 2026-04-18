/**
 * Role & Permission management controller.
 *
 * Two operational scopes:
 *   • org scope  — used by portal. Lists/creates/edits roles where orgId = req.orgId.
 *                  Built-in org-scope system roles (orgId=null) are also returned but
 *                  cannot be edited / deleted (enforced by isSystem flag).
 *   • admin scope — used by admin-app (superadmin only). Lists and edits ALL roles
 *                   including admin-scope system roles (superadmin).
 */

import prisma from '../config/postgres.js';
import { ALL_PERMISSIONS } from '../rbac/permissionCatalog.js';

// ─── Permission catalog (read-only) ──────────────────────────────────────
export async function listPermissions(req, res, next) {
  try {
    const scope = req.query.scope; // 'org' | 'admin' | undefined (all)
    const perms = await prisma.permission.findMany({
      where: scope ? { scope } : undefined,
      orderBy: [{ scope: 'asc' }, { module: 'asc' }, { action: 'asc' }],
    });
    // Group by module for convenience in UI
    const grouped = {};
    for (const p of perms) {
      if (!grouped[p.module]) grouped[p.module] = [];
      grouped[p.module].push(p);
    }
    res.json({ permissions: perms, grouped });
  } catch (err) { next(err); }
}

// ─── List roles (org-scope for portal, all for admin) ────────────────────
// Query: ?includeSystem=true to include built-in system roles in the list.
export async function listRoles(req, res, next) {
  try {
    const isAdminScope = req.query.scope === 'admin';
    const includeSystem = req.query.includeSystem !== 'false';

    let where;
    if (isAdminScope) {
      // admin-app: return only admin-scope roles
      where = { scope: 'admin' };
    } else {
      // portal: org's own roles + built-in org-scope system roles (if requested)
      where = {
        OR: [
          { orgId: req.orgId },
          ...(includeSystem ? [{ orgId: null, scope: 'org', isSystem: true }] : []),
        ],
      };
    }

    const roles = await prisma.role.findMany({
      where,
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: {
        rolePermissions: { select: { permission: { select: { key: true } } } },
        userRoles:       { select: { userId: true } },
      },
    });

    // Also count users where `User.role = role.key`. Custom roles and system
    // roles are both captured this way (the legacy `User.role` column can
    // hold either). We union with UserRole junction entries for a single
    // accurate "people currently using this role" number.
    const roleKeys = [...new Set(roles.map(r => r.key))];
    const legacyUsers = await prisma.user.findMany({
      where: {
        role: { in: roleKeys },
        ...(req.orgId ? { orgId: req.orgId } : {}),
      },
      select: { id: true, role: true },
    });
    const legacyByKey = {};
    for (const u of legacyUsers) {
      (legacyByKey[u.role] ??= new Set()).add(u.id);
    }

    const shaped = roles.map(r => {
      const users = new Set(r.userRoles.map(ur => ur.userId));
      if (legacyByKey[r.key]) legacyByKey[r.key].forEach(id => users.add(id));
      return {
        id: r.id,
        orgId: r.orgId,
        key: r.key,
        name: r.name,
        description: r.description,
        status: r.status,
        scope: r.scope,
        isSystem: r.isSystem,
        isCustomized: r.isCustomized,
        permissions: r.rolePermissions.map(rp => rp.permission.key),
        userCount: users.size,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });

    res.json({ roles: shaped });
  } catch (err) { next(err); }
}

export async function getRole(req, res, next) {
  try {
    const role = await prisma.role.findUnique({
      where: { id: req.params.id },
      include: {
        rolePermissions: { select: { permission: { select: { key: true } } } },
        userRoles:       { select: { userId: true } },
      },
    });
    if (!role) return res.status(404).json({ error: 'Role not found' });
    // Scope check: org users can only read their own org's custom roles + system roles
    if (req.user.role !== 'superadmin' && role.orgId && role.orgId !== req.orgId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Union UserRole holders with users whose legacy `User.role = role.key`.
    const legacy = await prisma.user.findMany({
      where: {
        role: role.key,
        ...(req.orgId ? { orgId: req.orgId } : {}),
      },
      select: { id: true },
    });
    const users = new Set(role.userRoles.map(ur => ur.userId));
    legacy.forEach(u => users.add(u.id));

    res.json({
      id: role.id, orgId: role.orgId, key: role.key, name: role.name,
      description: role.description, status: role.status, scope: role.scope,
      isSystem: role.isSystem, isCustomized: role.isCustomized,
      permissions: role.rolePermissions.map(rp => rp.permission.key),
      userCount: users.size,
    });
  } catch (err) { next(err); }
}

export async function createRole(req, res, next) {
  try {
    const { key, name, description, permissions = [], status = 'active' } = req.body;
    const isAdminScope = req.query.scope === 'admin';

    if (!name || !key) return res.status(400).json({ error: 'key and name are required' });
    if (!/^[a-z0-9_]+$/.test(key)) {
      return res.status(400).json({ error: 'key must be lowercase letters, digits, or underscores' });
    }

    // Only superadmin can create admin-scope roles
    if (isAdminScope && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Admin-scope roles require superadmin' });
    }

    const orgId = isAdminScope ? null : req.orgId;

    // Prevent collision with system role keys
    const collision = await prisma.role.findFirst({
      where: { orgId, key },
    });
    if (collision) return res.status(409).json({ error: `A role with key "${key}" already exists` });

    // Validate permission keys
    const perms = await prisma.permission.findMany({
      where: { key: { in: permissions } },
      select: { id: true, key: true, scope: true },
    });

    // Org-scope roles can't hold admin-scope perms
    const badScope = perms.filter(p => isAdminScope ? false : p.scope !== 'org');
    if (badScope.length) {
      return res.status(400).json({ error: `Cannot assign admin-scope permissions to an org role: ${badScope.map(p=>p.key).join(', ')}` });
    }

    const role = await prisma.role.create({
      data: {
        orgId,
        key,
        name,
        description: description || null,
        scope: isAdminScope ? 'admin' : 'org',
        status,
        isSystem: false,
        rolePermissions: {
          create: perms.map(p => ({ permissionId: p.id })),
        },
      },
    });

    res.status(201).json({ id: role.id, key: role.key, name: role.name });
  } catch (err) { next(err); }
}

export async function updateRole(req, res, next) {
  try {
    const { name, description, permissions, status } = req.body;
    const role = await prisma.role.findUnique({ where: { id: req.params.id } });
    if (!role) return res.status(404).json({ error: 'Role not found' });

    // Scope guard — org admins can only edit their own org's roles.
    // System roles (orgId=null) are editable by superadmin OR by org-admins
    // for org-scope system roles, so tenants can customize their role set.
    if (req.user.role !== 'superadmin') {
      // Custom org role → must belong to caller's org
      if (role.orgId && role.orgId !== req.orgId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      // Admin-scope system role → superadmin only
      if (role.isSystem && role.scope === 'admin') {
        return res.status(403).json({ error: 'Admin-scope system roles require superadmin' });
      }
    }

    const data = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (status !== undefined && ['active','inactive'].includes(status)) data.status = status;
    // NOTE: role.key is intentionally NOT editable — it's load-bearing for
    // legacy authorize(...) calls and the User.role mapping.

    await prisma.role.update({ where: { id: role.id }, data });

    // Flag system roles as customized via raw SQL so the seeder won't
    // overwrite admin edits. We use raw SQL (not the typed Prisma client)
    // because the client may not have been regenerated yet for this column
    // (the backend process often holds the DLL, blocking `prisma generate`).
    // If the column somehow doesn't exist, the error is swallowed silently.
    if (role.isSystem) {
      await prisma.$executeRaw`UPDATE roles SET "isCustomized" = true WHERE id = ${role.id}`
        .catch(err => console.warn('isCustomized flag update skipped:', err.message));
    }

    if (Array.isArray(permissions)) {
      const perms = await prisma.permission.findMany({
        where: { key: { in: permissions } },
        select: { id: true, scope: true, key: true },
      });
      const badScope = perms.filter(p => role.scope !== p.scope);
      if (badScope.length) {
        return res.status(400).json({ error: `Permission scope mismatch: ${badScope.map(p=>p.key).join(', ')}` });
      }

      // Replace all permissions
      await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
      if (perms.length) {
        await prisma.rolePermission.createMany({
          data: perms.map(p => ({ roleId: role.id, permissionId: p.id })),
        });
      }
    }

    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function deleteRole(req, res, next) {
  try {
    const role = await prisma.role.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { userRoles: true } } },
    });
    if (!role) return res.status(404).json({ error: 'Role not found' });
    if (role.isSystem) return res.status(400).json({ error: 'System roles cannot be deleted' });

    if (req.user.role !== 'superadmin') {
      if (!role.orgId || role.orgId !== req.orgId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    if (role._count.userRoles > 0) {
      return res.status(400).json({
        error: `Role is assigned to ${role._count.userRoles} user(s). Unassign before deleting.`,
      });
    }

    await prisma.role.delete({ where: { id: role.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
}

// ─── User-role assignment ───────────────────────────────────────────────
export async function getUserRoles(req, res, next) {
  try {
    const userId = req.params.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, orgId: true, role: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (req.user.role !== 'superadmin' && user.orgId !== req.orgId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: { role: { select: { id: true, key: true, name: true, scope: true, isSystem: true } } },
    });
    res.json({
      legacyRole: user.role,
      roles: userRoles.map(ur => ur.role),
    });
  } catch (err) { next(err); }
}

export async function setUserRoles(req, res, next) {
  try {
    const userId = req.params.userId;
    const { roleIds = [] } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, orgId: true, role: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (req.user.role !== 'superadmin' && user.orgId !== req.orgId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Validate the target roles exist and are assignable by this caller
    const targetRoles = await prisma.role.findMany({ where: { id: { in: roleIds } } });
    if (targetRoles.length !== roleIds.length) {
      return res.status(400).json({ error: 'One or more roles not found' });
    }
    for (const r of targetRoles) {
      if (r.status !== 'active') {
        return res.status(400).json({ error: `Role "${r.name}" is inactive` });
      }
      // Org admins can only assign roles in their own org (or global system roles)
      if (req.user.role !== 'superadmin') {
        if (r.orgId && r.orgId !== req.orgId) {
          return res.status(403).json({ error: `Cannot assign role "${r.name}" from another org` });
        }
        if (r.scope === 'admin') {
          return res.status(403).json({ error: 'Admin-scope roles require superadmin' });
        }
      }
    }

    // Replace the user's role set
    await prisma.userRole.deleteMany({ where: { userId } });
    if (roleIds.length) {
      await prisma.userRole.createMany({
        data: roleIds.map(roleId => ({ userId, roleId })),
        skipDuplicates: true,
      });
    }

    res.json({ success: true });
  } catch (err) { next(err); }
}

// ─── Current user — "me" endpoint for permission refresh ────────────────
export async function getMyPermissions(req, res, next) {
  try {
    const { computeUserPermissions } = await import('../rbac/permissionService.js');
    const permissions = await computeUserPermissions(req.user);
    res.json({
      id: req.user.id, name: req.user.name, email: req.user.email,
      role: req.user.role, orgId: req.user.orgId, permissions,
    });
  } catch (err) { next(err); }
}
