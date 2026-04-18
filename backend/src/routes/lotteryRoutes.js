/**
 * Lottery Routes
 *
 * Permissions (all require auth + tenant scope):
 *   lottery.view    — list games/boxes/tx/reports (cashier+)
 *   lottery.create  — record a lottery sale/payout (cashier+)
 *   lottery.edit    — update games/boxes/settings (manager+)
 *   lottery.delete  — remove games/boxes (manager+)
 *   lottery.manage  — shift reports, commission, catalog admin (manager+ / admin)
 */

import express from 'express';
import { protect } from '../middleware/auth.js';
import { scopeToTenant } from '../middleware/scopeToTenant.js';
import { requirePermission } from '../rbac/permissionService.js';
import {
  getLotteryGames, createLotteryGame, updateLotteryGame, deleteLotteryGame,
  getLotteryBoxes, receiveBoxOrder, activateBox, updateBox, deleteBox, adjustBoxTickets,
  getLotteryTransactions, createLotteryTransaction, bulkCreateLotteryTransactions,
  getLotteryShiftReport, saveLotteryShiftReport, getShiftReports,
  getLotteryDashboard, getLotteryReport, getLotteryCommissionReport,
  getLotterySettings, updateLotterySettings,
  getCatalogTickets, getAllCatalogTickets, createCatalogTicket, updateCatalogTicket, deleteCatalogTicket,
  getTicketRequests, createTicketRequest, reviewTicketRequest, getPendingRequestCount,
  receiveFromCatalog,
} from '../controllers/lotteryController.js';

const router = express.Router();
router.use(protect);
router.use(scopeToTenant);

// Games
router.get(   '/games',       requirePermission('lottery.view'),   getLotteryGames);
router.post(  '/games',       requirePermission('lottery.create'), createLotteryGame);
router.put(   '/games/:id',   requirePermission('lottery.edit'),   updateLotteryGame);
router.delete('/games/:id',   requirePermission('lottery.delete'), deleteLotteryGame);

// Boxes
router.get(   '/boxes',              requirePermission('lottery.view'),   getLotteryBoxes);
router.post(  '/boxes/receive',      requirePermission('lottery.manage'), receiveBoxOrder);
router.put(   '/boxes/:id/activate', requirePermission('lottery.manage'), activateBox);
router.post(  '/boxes/:id/adjust',   requirePermission('lottery.manage'), adjustBoxTickets);
router.put(   '/boxes/:id',          requirePermission('lottery.edit'),   updateBox);
router.delete('/boxes/:id',          requirePermission('lottery.delete'), deleteBox);

// Transactions
router.get( '/transactions',       requirePermission('lottery.view'),   getLotteryTransactions);
router.post('/transactions',       requirePermission('lottery.create'), createLotteryTransaction);
router.post('/transactions/bulk',  requirePermission('lottery.create'), bulkCreateLotteryTransactions);

// Shift reports
router.get( '/shift-reports',          requirePermission('lottery.manage'), getShiftReports);
router.get( '/shift-reports/:shiftId', requirePermission('lottery.view'),   getLotteryShiftReport);
router.post('/shift-reports',          requirePermission('lottery.manage'), saveLotteryShiftReport);

// Analytics
router.get('/dashboard',  requirePermission('lottery.manage'), getLotteryDashboard);
router.get('/report',     requirePermission('lottery.manage'), getLotteryReport);
router.get('/commission', requirePermission('lottery.manage'), getLotteryCommissionReport);

// Settings
router.get('/settings', requirePermission('lottery.view'), getLotterySettings);
router.put('/settings', requirePermission('lottery.edit'), updateLotterySettings);

// Ticket catalog (admin-scope — superadmin bypass keeps this available to platform admins)
router.get(   '/catalog',         requirePermission('lottery.view'),   getCatalogTickets);
router.get(   '/catalog/all',     requirePermission('lottery.manage'), getAllCatalogTickets);
router.post(  '/catalog',         requirePermission('lottery.manage'), createCatalogTicket);
router.put(   '/catalog/:id',     requirePermission('lottery.manage'), updateCatalogTicket);
router.delete('/catalog/:id',     requirePermission('lottery.manage'), deleteCatalogTicket);

// Ticket Requests
router.get( '/ticket-requests',               requirePermission('lottery.view'),   getTicketRequests);
router.get( '/ticket-requests/pending-count', requirePermission('lottery.manage'), getPendingRequestCount);
router.post('/ticket-requests',               requirePermission('lottery.create'), createTicketRequest);
router.put( '/ticket-requests/:id/review',    requirePermission('lottery.manage'), reviewTicketRequest);

// Receive from Catalog
router.post('/boxes/receive-catalog', requirePermission('lottery.manage'), receiveFromCatalog);

export default router;
