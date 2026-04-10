/**
 * Label Queue Routes — /api/label-queue
 */

import express from 'express';
import { protect } from '../middleware/auth.js';
import { scopeToTenant } from '../middleware/scopeToTenant.js';
import {
  getLabelQueue,
  getQueueCount,
  addManualItem,
  markAsPrinted,
  dismissItems,
  clearOldItems,
} from '../services/labelQueueService.js';

const router = express.Router();

router.use(protect);
router.use(scopeToTenant);

// GET / — Fetch pending label queue
router.get('/', async (req, res) => {
  try {
    const result = await getLabelQueue(req.orgId, req.storeId, {
      reason: req.query.reason || undefined,
      search: req.query.search || undefined,
      status: req.query.status || 'pending',
    });
    res.json(result);
  } catch (err) {
    console.error('[LabelQueue GET]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /count — Pending count (for badge)
router.get('/count', async (req, res) => {
  try {
    const count = await getQueueCount(req.orgId, req.storeId);
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /add — Manually add products to queue
router.post('/add', async (req, res) => {
  try {
    const { productIds } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'productIds array is required' });
    }
    const results = [];
    for (const pid of productIds) {
      const item = await addManualItem(req.orgId, req.storeId, parseInt(pid));
      results.push(item);
    }
    res.json({ added: results.length, data: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /print — Mark items as printed
router.post('/print', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const result = await markAsPrinted(ids, req.user?.id || null);
    res.json({ updated: result.count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /dismiss — Dismiss items
router.post('/dismiss', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const result = await dismissItems(ids);
    res.json({ updated: result.count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /clear — Remove old printed/dismissed items
router.delete('/clear', async (req, res) => {
  try {
    const result = await clearOldItems(req.orgId, parseInt(req.query.days) || 30);
    res.json({ deleted: result.count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
