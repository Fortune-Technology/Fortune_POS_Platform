/**
 * Reports Hub Routes — /api/reports/hub/*
 */
import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { scopeToTenant } from '../middleware/scopeToTenant.js';
import {
  getSummaryReport,
  getTaxReport,
  getInventoryReport,
  getCompareReport,
} from '../controllers/reportsHubController.js';

const router = Router();
router.use(protect);
router.use(scopeToTenant);

router.get('/summary',    getSummaryReport);
router.get('/tax',        getTaxReport);
router.get('/inventory',  getInventoryReport);
router.get('/compare',    getCompareReport);

export default router;
