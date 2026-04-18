/**
 * User management routes  —  /api/users
 * Requires: protect (auth) + admin or above role
 */

import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { requireTenant } from '../middleware/scopeToTenant.js';
import { requirePermission } from '../rbac/permissionService.js';
import {
  getTenantUsers,
  inviteUser,
  updateUserRole,
  removeUser,
} from '../controllers/userManagementController.js';
import { setCashierPin, removeCashierPin } from '../controllers/stationController.js';

const router = Router();

router.use(protect);

// List — users.view
router.get('/', requirePermission('users.view'), getTenantUsers);

// Invite / manage
router.post('/invite',   requirePermission('users.create'), inviteUser);
router.put('/:id/role',  requirePermission('users.edit'),   updateUserRole);
router.delete('/:id',    requirePermission('users.delete'), removeUser);

// POS PIN management — users.edit (manager+)
router.route('/:id/pin')
  .put(requirePermission('users.edit'), requireTenant, setCashierPin)
  .delete(requirePermission('users.edit'), requireTenant, removeCashierPin);

export default router;
