/**
 * User Management Controller  —  /api/users
 *
 * Manages users within an org (invite, list, role change, remove).
 * All mutations are scoped to req.orgId.
 */

import bcrypt from 'bcryptjs';
import prisma from '../config/postgres.js';
import { syncUserDefaultRole } from '../rbac/permissionService.js';

// Role keys that cannot be assigned via Invite / Role-change UI.
// Owner is set only on org creation; superadmin is platform-level.
const FIXED_ROLE_KEYS = ['owner', 'superadmin'];

// Roles that are restricted to exactly one store.
const SINGLE_STORE_ROLE_KEYS = new Set(['cashier']);

/**
 * Verify that `roleKey` is an assignable role (system or org-custom) for
 * this org. Returns the Role row or null.
 */
async function resolveAssignableRole(orgId, roleKey) {
  if (!roleKey) return null;
  if (FIXED_ROLE_KEYS.includes(roleKey)) return null;
  return prisma.role.findFirst({
    where: {
      key: roleKey,
      status: 'active',
      scope: 'org',
      OR: [
        { orgId: null, isSystem: true },      // built-in system roles
        { orgId },                            // org-specific custom roles
      ],
    },
  });
}

/* ── GET /api/users  — list all users in this org ───────────────────────── */
export const getTenantUsers = async (req, res, next) => {
  try {
    if (!req.orgId) {
      return res.status(403).json({ error: 'No organisation context.' });
    }

    const users = await prisma.user.findMany({
      where: { orgId: req.orgId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        posPin: true,
        createdAt: true,
        stores: {
          select: {
            store: { select: { id: true, name: true, address: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Flatten store list + add _id alias for frontend compat + hasPIN flag
    const result = users.map(u => ({
      ...u,
      _id:    u.id,
      hasPIN: !!u.posPin,
      posPin: undefined, // never expose the hash
      stores: u.stores.map(us => ({ ...us.store, _id: us.store.id })),
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
};

/* ── POST /api/users/invite  — create & add user to org ─────────────────── */
export const inviteUser = async (req, res, next) => {
  try {
    if (!req.orgId) {
      return res.status(403).json({ error: 'No organisation context.' });
    }

    const [userCount, org] = await Promise.all([
      prisma.user.count({ where: { orgId: req.orgId } }),
      prisma.organization.findUnique({
        where: { id: req.orgId },
        select: { maxUsers: true, plan: true },
      }),
    ]);

    if (userCount >= (org?.maxUsers ?? 5)) {
      return res.status(402).json({
        error: `Your ${org?.plan} plan allows ${org?.maxUsers} users. Upgrade to invite more.`,
      });
    }

    const { firstName, lastName, name, email, phone, role, storeIds, password, pin } = req.body;

    // Require either firstName+lastName or legacy name, plus email
    if ((!firstName && !lastName && !name) || !email) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }

    // Email format validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address format.' });
    }

    // Phone format validation (if provided)
    if (phone && !/^\+?[\d\s\-\(\)]{7,15}$/.test(phone.replace(/\s/g, ''))) {
      return res.status(400).json({ error: 'Invalid phone number format.' });
    }

    const effectiveRole = role || 'cashier';
    const roleRow = await resolveAssignableRole(req.orgId, effectiveRole);
    if (!roleRow) {
      return res.status(400).json({ error: `Role "${effectiveRole}" is not assignable. Create it in Roles & Permissions or pick an active role.` });
    }

    const storeList = Array.isArray(storeIds) ? storeIds.filter(Boolean) : [];
    if (SINGLE_STORE_ROLE_KEYS.has(effectiveRole) && storeList.length !== 1) {
      return res.status(400).json({ error: `The "${roleRow.name}" role must be assigned to exactly one store.` });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return res.status(400).json({ error: 'A user with this email already exists.' });
    }

    // Build full name — prefer split fields, fall back to legacy combined name
    const nameFull = firstName && lastName
      ? `${firstName.trim()} ${lastName.trim()}`
      : (name || '').trim();

    // Password: use provided password or generate a temp one
    const tempPassword = password ? null : (Math.random().toString(36).slice(-8) + '!A1');
    const hashed = await bcrypt.hash(password || tempPassword, 12);

    // PIN: hash if provided and valid
    let posPin = null;
    if (pin && /^\d{4,6}$/.test(pin)) {
      posPin = await bcrypt.hash(pin, 12);
    }

    const user = await prisma.user.create({
      data: {
        name:     nameFull,
        email:    email.toLowerCase().trim(),
        phone:    phone || null,
        password: hashed,
        posPin,
        role:     effectiveRole,
        orgId:    req.orgId,
        stores:   storeList.length > 0
          ? { create: storeList.map(sid => ({ storeId: sid })) }
          : undefined,
      },
    });

    await syncUserDefaultRole(user.id).catch(err => console.warn('syncUserDefaultRole:', err.message));

    const responseBody = {
      user: {
        id:        user.id,
        _id:       user.id,
        name:      user.name,
        email:     user.email,
        role:      user.role,
        orgId:     user.orgId,
        hasPIN:    !!user.posPin,
        createdAt: user.createdAt,
      },
    };

    // Only include tempPassword in response if the caller did NOT supply a password
    if (tempPassword) {
      responseBody.tempPassword = tempPassword;
    }

    res.status(201).json(responseBody);
  } catch (err) {
    next(err);
  }
};

/* ── PUT /api/users/:id/role  — update role + store assignments ──────────── */
export const updateUserRole = async (req, res, next) => {
  try {
    const { role, storeIds } = req.body;

    if (role) {
      const rr = await resolveAssignableRole(req.orgId, role);
      if (!rr) return res.status(400).json({ error: `Role "${role}" is not assignable.` });
    }

    const target = await prisma.user.findFirst({
      where: { id: req.params.id, orgId: req.orgId },
    });
    if (!target) return res.status(404).json({ error: 'User not found in your organisation.' });
    if (target.role === 'owner') {
      return res.status(403).json({ error: 'Cannot change the role of the organisation owner.' });
    }

    const effectiveRole = role || target.role;
    const storeList = Array.isArray(storeIds) ? storeIds.filter(Boolean) : undefined;

    if (storeList !== undefined && SINGLE_STORE_ROLE_KEYS.has(effectiveRole) && storeList.length !== 1) {
      return res.status(400).json({ error: `The "${effectiveRole}" role must be assigned to exactly one store.` });
    }

    const data = {};
    if (role) data.role = role;

    // Replace store assignments atomically
    if (storeList !== undefined) {
      await prisma.userStore.deleteMany({ where: { userId: req.params.id } });
      if (storeList.length > 0) {
        await prisma.userStore.createMany({
          data: storeList.map(sid => ({ userId: req.params.id, storeId: sid })),
        });
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: {
        id: true, name: true, email: true, role: true,
        stores: { select: { store: { select: { id: true, name: true } } } },
      },
    });

    if (role) {
      await syncUserDefaultRole(updated.id).catch(err => console.warn('syncUserDefaultRole:', err.message));
    }

    res.json({ ...updated, _id: updated.id, stores: updated.stores.map(us => ({ ...us.store, _id: us.store.id })) });
  } catch (err) {
    next(err);
  }
};

/* ── DELETE /api/users/:id  — remove user from org ─────────────────────── */
export const removeUser = async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot remove yourself.' });
    }

    const user = await prisma.user.findFirst({
      where: { id: req.params.id, orgId: req.orgId },
    });
    if (!user) return res.status(404).json({ error: 'User not found in your organisation.' });
    if (user.role === 'owner') {
      return res.status(403).json({ error: 'Cannot remove the organisation owner.' });
    }

    // Detach from org + remove store assignments
    await prisma.$transaction([
      prisma.userStore.deleteMany({ where: { userId: req.params.id } }),
      prisma.user.update({
        where: { id: req.params.id },
        data: { orgId: 'detached' },
      }),
    ]);

    res.json({ message: `${user.name} has been removed from the organisation.` });
  } catch (err) {
    next(err);
  }
};
