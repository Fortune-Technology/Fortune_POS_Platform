/**
 * Price Scenario Controller — superadmin-only.
 *
 * Stores saved Interchange-plus pricing scenarios that the sales team uses
 * to pitch the StoreVeu processing model to prospective merchants. Not
 * tenant-scoped — these live at the platform level and are managed from the
 * admin panel. All routes require role === 'superadmin'.
 */

import prisma from '../config/postgres.js';

// ── GET /api/price-scenarios ─────────────────────────────────────────────
export const listPriceScenarios = async (req, res) => {
  try {
    const { search } = req.query;
    const where = {};
    if (search) {
      where.OR = [
        { storeName: { contains: search, mode: 'insensitive' } },
        { location:  { contains: search, mode: 'insensitive' } },
      ];
    }
    const scenarios = await prisma.priceScenario.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
    res.json({ scenarios });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/price-scenarios/:id ─────────────────────────────────────────
export const getPriceScenario = async (req, res) => {
  try {
    const scenario = await prisma.priceScenario.findUnique({
      where: { id: req.params.id },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });
    if (!scenario) return res.status(404).json({ error: 'Scenario not found' });
    res.json(scenario);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/price-scenarios ────────────────────────────────────────────
export const createPriceScenario = async (req, res) => {
  try {
    const { storeName, location, mcc, notes, inputs, results } = req.body;
    if (!storeName || !String(storeName).trim()) {
      return res.status(400).json({ error: 'storeName is required' });
    }
    if (!inputs || typeof inputs !== 'object') {
      return res.status(400).json({ error: 'inputs object is required' });
    }
    if (!results || typeof results !== 'object') {
      return res.status(400).json({ error: 'results object is required' });
    }

    const scenario = await prisma.priceScenario.create({
      data: {
        storeName:   String(storeName).trim(),
        location:    location ? String(location).trim() : null,
        mcc:         mcc ? String(mcc).trim() : null,
        notes:       notes ? String(notes) : null,
        inputs,
        results,
        createdById: req.user?.id || null,
      },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });
    res.status(201).json(scenario);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── PUT /api/price-scenarios/:id ─────────────────────────────────────────
export const updatePriceScenario = async (req, res) => {
  try {
    const { storeName, location, mcc, notes, inputs, results } = req.body;

    const existing = await prisma.priceScenario.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Scenario not found' });

    const scenario = await prisma.priceScenario.update({
      where: { id: req.params.id },
      data: {
        ...(storeName !== undefined && { storeName: String(storeName).trim() }),
        ...(location  !== undefined && { location: location ? String(location).trim() : null }),
        ...(mcc       !== undefined && { mcc: mcc ? String(mcc).trim() : null }),
        ...(notes     !== undefined && { notes: notes ? String(notes) : null }),
        ...(inputs    !== undefined && { inputs }),
        ...(results   !== undefined && { results }),
      },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });
    res.json(scenario);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── DELETE /api/price-scenarios/:id ──────────────────────────────────────
export const deletePriceScenario = async (req, res) => {
  try {
    const existing = await prisma.priceScenario.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Scenario not found' });

    await prisma.priceScenario.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
