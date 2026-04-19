/**
 * Quick Button Layout Controller — per-store cashier home-screen editor.
 *
 * One layout row per store (storeId is unique). Portal writes it via the
 * drag-and-drop builder; cashier-app reads it + renders the tile grid.
 *
 * Depth validation: a folder's `children[]` may contain leaf tiles
 * (product / action / text / image) only — NEVER another folder. The save
 * handler rejects deeper nesting with 400 so the cashier-renderer and
 * back-button navigation don't need to handle N-level depth.
 */

import prisma from '../config/postgres.js';
import path   from 'path';
import fs     from 'fs';
import multer from 'multer';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'quick-buttons');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    cb(null, safe);
  },
});

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
    cb(null, true);
  },
}).single('file');

// Valid leaf tile types (everything except 'folder')
const LEAF_TYPES = new Set(['product', 'action', 'text', 'image']);
// Valid action keys — whitelist so clients can't invent unknown handlers
const VALID_ACTIONS = new Set([
  'discount', 'void', 'refund', 'open_drawer', 'no_sale', 'print_last_receipt',
  'customer_lookup', 'customer_add', 'price_check', 'hold', 'recall',
  'cash_drop', 'payout', 'end_of_day', 'lottery_sale', 'fuel_sale',
  'bottle_return', 'manual_entry', 'clock_event',
]);

function validateTile(tile, depth = 0) {
  if (!tile || typeof tile !== 'object') throw new Error('Tile must be an object');
  if (!tile.id || typeof tile.id !== 'string') throw new Error('Tile missing id');
  if (typeof tile.x !== 'number' || typeof tile.y !== 'number') throw new Error(`Tile ${tile.id}: x/y must be numbers`);
  if (typeof tile.w !== 'number' || typeof tile.h !== 'number') throw new Error(`Tile ${tile.id}: w/h must be numbers`);
  if (tile.w < 1 || tile.h < 1) throw new Error(`Tile ${tile.id}: w/h must be >= 1`);

  if (tile.type === 'folder') {
    if (depth >= 1) {
      throw new Error(`Folder "${tile.label || tile.id}": nested folders not allowed (max 1 level deep)`);
    }
    if (tile.children && !Array.isArray(tile.children)) {
      throw new Error(`Folder ${tile.id}: children must be an array`);
    }
    (tile.children || []).forEach(c => validateTile(c, depth + 1));
    return;
  }

  if (!LEAF_TYPES.has(tile.type)) {
    throw new Error(`Tile ${tile.id}: unknown type "${tile.type}"`);
  }

  if (tile.type === 'action' && !VALID_ACTIONS.has(tile.actionKey)) {
    throw new Error(`Tile ${tile.id}: unknown actionKey "${tile.actionKey}"`);
  }
  if (tile.type === 'product' && !tile.productId) {
    throw new Error(`Tile ${tile.id}: product tile missing productId`);
  }
  if (tile.type === 'image' && !tile.imageUrl) {
    throw new Error(`Tile ${tile.id}: image tile missing imageUrl`);
  }
}

function validateTree(tree) {
  if (!Array.isArray(tree)) throw new Error('Layout tree must be an array');
  tree.forEach(t => validateTile(t, 0));
}

// ── GET /api/quick-buttons?storeId=... ─────────────────────────────────
export const getLayout = async (req, res) => {
  try {
    const orgId = req.orgId || req.user?.orgId;
    const storeId = req.query.storeId || req.storeId;
    if (!storeId) return res.status(400).json({ error: 'storeId required' });

    const layout = await prisma.quickButtonLayout.findUnique({ where: { storeId } });
    if (!layout) {
      return res.json({
        storeId,
        name:      'Main Screen',
        gridCols:  6,
        rowHeight: 56,
        tree:      [],
        updatedAt: null,
      });
    }
    // Ownership check
    if (layout.orgId !== orgId && req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Layout belongs to a different organisation' });
    }
    res.json(layout);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── PUT /api/quick-buttons ─────────────────────────────────────────────
// Body: { storeId, name?, gridCols?, rowHeight?, tree }
export const saveLayout = async (req, res) => {
  try {
    const orgId = req.orgId || req.user?.orgId;
    const { storeId, name, gridCols, rowHeight, tree } = req.body;
    if (!storeId) return res.status(400).json({ error: 'storeId required' });

    // Validate store ownership
    const store = await prisma.store.findFirst({ where: { id: storeId, orgId } });
    if (!store) return res.status(404).json({ error: 'Store not found' });

    try {
      validateTree(tree || []);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    const gc = Math.max(3, Math.min(12, Number(gridCols) || 6));
    // Tile height in pixels for a 1-row-tall tile. Clamped to sensible
    // POS-touch-target range — 40px is getting tight, 160px wastes space.
    const rh = Math.max(40, Math.min(160, Number(rowHeight) || 56));

    const saved = await prisma.quickButtonLayout.upsert({
      where:  { storeId },
      update: {
        name:      name || 'Main Screen',
        gridCols:  gc,
        rowHeight: rh,
        tree:      tree || [],
      },
      create: {
        orgId, storeId,
        name:      name || 'Main Screen',
        gridCols:  gc,
        rowHeight: rh,
        tree:      tree || [],
      },
    });
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/quick-buttons/upload ─────────────────────────────────────
// multer middleware attached in the route file. Returns `{ url }` pointing
// at the static /uploads route so the client can paste it directly into a
// tile's `imageUrl` field.
export const uploadImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    // URL served by express.static mount in server.js
    const url = `/uploads/quick-buttons/${req.file.filename}`;
    res.status(201).json({ url, size: req.file.size, type: req.file.mimetype });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── DELETE /api/quick-buttons ──────────────────────────────────────────
// Clears the layout for a store (tiles=[], not deleted row). Useful for a
// "Reset layout" button.
export const clearLayout = async (req, res) => {
  try {
    const orgId = req.orgId || req.user?.orgId;
    const { storeId } = req.body;
    if (!storeId) return res.status(400).json({ error: 'storeId required' });
    const store = await prisma.store.findFirst({ where: { id: storeId, orgId } });
    if (!store) return res.status(404).json({ error: 'Store not found' });

    await prisma.quickButtonLayout.upsert({
      where:  { storeId },
      update: { tree: [] },
      create: { orgId, storeId, tree: [] },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Public list of valid action keys for the portal builder's palette
export const listActions = (req, res) => {
  res.json({ actions: Array.from(VALID_ACTIONS) });
};
