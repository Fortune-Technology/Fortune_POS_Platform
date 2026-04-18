/**
 * Fuel Routes — gas station mode.
 *
 * Permissions:
 *   fuel.view   — list types/settings/transactions (cashier+)
 *   fuel.create — record a fuel sale (cashier+)
 *   fuel.edit   — manage types/settings (manager+)
 *   fuel.delete — remove types (manager+)
 */

import express from 'express';
import { protect } from '../middleware/auth.js';
import { scopeToTenant } from '../middleware/scopeToTenant.js';
import { requirePermission } from '../rbac/permissionService.js';
import {
  getFuelTypes, createFuelType, updateFuelType, deleteFuelType,
  getFuelSettings, updateFuelSettings,
  listFuelTransactions, getFuelReport, getFuelDashboard,
} from '../controllers/fuelController.js';

const router = express.Router();
router.use(protect);
router.use(scopeToTenant);

// Types
router.get(   '/types',        requirePermission('fuel.view'),   getFuelTypes);
router.post(  '/types',        requirePermission('fuel.create'), createFuelType);
router.put(   '/types/:id',    requirePermission('fuel.edit'),   updateFuelType);
router.delete('/types/:id',    requirePermission('fuel.delete'), deleteFuelType);

// Settings
router.get('/settings', requirePermission('fuel.view'), getFuelSettings);
router.put('/settings', requirePermission('fuel.edit'), updateFuelSettings);

// Transactions / Reports
router.get('/transactions', requirePermission('fuel.view'), listFuelTransactions);
router.get('/report',       requirePermission('fuel.edit'), getFuelReport);
router.get('/dashboard',    requirePermission('fuel.edit'), getFuelDashboard);

export default router;
