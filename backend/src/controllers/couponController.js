/**
 * couponController.js  (Session 45 — catalog only)
 *
 * Manages the ManufacturerCoupon catalog — the corpus of coupons retailers
 * accept at the register and submit for reimbursement via scan data feeds.
 *
 * In Session 45:
 *   • CRUD for ManufacturerCoupon rows (manual entry primary)
 *   • CSV import (best-effort; column-tolerant)
 *   • Read-only redemption history endpoints
 *
 * In Session 46:
 *   • POS coupon validation + apply (cashier-app)
 *   • Threshold-aware manager-PIN gate
 *   • Auto-flow into ScanDataSubmission rows
 *
 * Permissions:
 *   coupons.view    — manager+ (catalog read)
 *   coupons.manage  — manager+ (catalog CRUD + import)
 *   coupons.redeem  — cashier+ (POS apply — Session 46)
 *   coupons.approve — manager+ (high-value gate — Session 46)
 */

import prisma from '../config/postgres.js';

const getOrgId = (req) => req.orgId || req.user?.orgId;

const num = (v) => (v != null && v !== '' ? Number(v) : null);
const safeDate = (v) => (v ? new Date(v) : null);

// ══════════════════════════════════════════════════════════════════════════
// COUPON CATALOG
// ══════════════════════════════════════════════════════════════════════════

export const listCoupons = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { manufacturerId, brandFamily, active, expired, search, limit } = req.query;

    const where = {
      OR: [{ orgId }, { orgId: null }], // include platform-wide coupons
    };
    if (manufacturerId) where.manufacturerId = String(manufacturerId);
    if (brandFamily)    where.brandFamily = String(brandFamily);
    if (active === 'true')  where.active = true;
    if (active === 'false') where.active = false;
    if (expired === 'true')  where.expirationDate = { lt: new Date() };
    if (expired === 'false') where.expirationDate = { gte: new Date() };
    if (search) {
      where.AND = [
        { OR: [
          { serialNumber: { contains: String(search) } },
          { displayName:  { contains: String(search), mode: 'insensitive' } },
          { brandFamily:  { contains: String(search), mode: 'insensitive' } },
        ] },
      ];
    }

    const rows = await prisma.manufacturerCoupon.findMany({
      where,
      include: {
        manufacturer: {
          select: { id: true, code: true, name: true, shortName: true, parentMfrCode: true },
        },
        _count: { select: { redemptions: true } },
      },
      orderBy: [{ active: 'desc' }, { expirationDate: 'asc' }],
      take: Math.min(Number(limit) || 200, 1000),
    });

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getCoupon = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { id } = req.params;

    const row = await prisma.manufacturerCoupon.findFirst({
      where: { id, OR: [{ orgId }, { orgId: null }] },
      include: { manufacturer: true, _count: { select: { redemptions: true } } },
    });
    if (!row) return res.status(404).json({ success: false, error: 'Coupon not found' });
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const createCoupon = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const {
      manufacturerId,
      serialNumber,
      displayName,
      brandFamily,
      discountType,
      discountAmount,
      effectiveDate,
      expirationDate,
      qualifyingUpcs,
      minQty,
      requiresMultipack,
      maxPerTx,
      maxPerCoupon,
      fundedBy,
    } = req.body;

    if (!manufacturerId || !serialNumber || !brandFamily || !discountType || discountAmount == null || !expirationDate) {
      return res.status(400).json({
        success: false,
        error: 'manufacturerId, serialNumber, brandFamily, discountType, discountAmount, and expirationDate are required',
      });
    }

    const mfr = await prisma.tobaccoManufacturer.findUnique({ where: { id: String(manufacturerId) } });
    if (!mfr) return res.status(400).json({ success: false, error: 'Unknown manufacturer feed' });

    if (!['fixed', 'percent'].includes(discountType)) {
      return res.status(400).json({ success: false, error: 'discountType must be "fixed" or "percent"' });
    }

    const dup = await prisma.manufacturerCoupon.findUnique({ where: { serialNumber: String(serialNumber) } });
    if (dup) {
      return res.status(409).json({ success: false, error: `Coupon serial ${serialNumber} is already in the catalog` });
    }

    const row = await prisma.manufacturerCoupon.create({
      data: {
        orgId,
        manufacturerId,
        serialNumber:    String(serialNumber).trim(),
        displayName:     displayName ? String(displayName).trim() : null,
        brandFamily:     String(brandFamily).trim(),
        discountType,
        discountAmount:  Number(discountAmount),
        effectiveDate:   safeDate(effectiveDate),
        expirationDate:  new Date(expirationDate),
        qualifyingUpcs:  Array.isArray(qualifyingUpcs) ? qualifyingUpcs.map(String) : [],
        minQty:          num(minQty) || 1,
        requiresMultipack: Boolean(requiresMultipack),
        maxPerTx:        num(maxPerTx),
        maxPerCoupon:    num(maxPerCoupon) || 1,
        fundedBy:        fundedBy === 'retailer' ? 'retailer' : 'manufacturer',
        createdById:     req.user?.id || null,
        importedFrom:    'manual',
      },
      include: { manufacturer: true },
    });

    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const updateCoupon = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { id } = req.params;

    const existing = await prisma.manufacturerCoupon.findFirst({
      where: { id, OR: [{ orgId }, { orgId: null }] },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Coupon not found' });

    const data = {};
    const fields = [
      'displayName', 'brandFamily', 'discountType', 'discountAmount',
      'effectiveDate', 'expirationDate', 'qualifyingUpcs',
      'minQty', 'requiresMultipack', 'maxPerTx', 'maxPerCoupon',
      'fundedBy', 'active',
    ];
    for (const f of fields) {
      if (f in req.body) data[f] = req.body[f];
    }
    if (data.discountAmount != null) data.discountAmount = Number(data.discountAmount);
    if (data.effectiveDate) data.effectiveDate = new Date(data.effectiveDate);
    if (data.expirationDate) data.expirationDate = new Date(data.expirationDate);
    if (data.qualifyingUpcs) data.qualifyingUpcs = data.qualifyingUpcs.map(String);
    if (data.minQty != null) data.minQty = Number(data.minQty);
    if (data.maxPerTx != null) data.maxPerTx = Number(data.maxPerTx);
    if (data.maxPerCoupon != null) data.maxPerCoupon = Number(data.maxPerCoupon);

    const updated = await prisma.manufacturerCoupon.update({
      where: { id },
      data,
      include: { manufacturer: true },
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const deleteCoupon = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { id } = req.params;
    const existing = await prisma.manufacturerCoupon.findFirst({
      where: { id, OR: [{ orgId }, { orgId: null }] },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Coupon not found' });

    // If any redemptions exist, soft-delete instead (FK preserved for audit trail)
    const redemptionCount = await prisma.couponRedemption.count({ where: { couponId: id } });
    if (redemptionCount > 0) {
      await prisma.manufacturerCoupon.update({ where: { id }, data: { active: false } });
      return res.json({ success: true, softDeleted: true, redemptionCount });
    }

    await prisma.manufacturerCoupon.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// CSV import — column-tolerant (matches common header variants).
// Expected columns (any case, any order):
//   serial / serialNumber / serial_number
//   manufacturer / manufacturerCode / mfr  (matches TobaccoManufacturer.code)
//   brand / brandFamily / family
//   discountType / type    (fixed | percent)
//   discountAmount / amount / value
//   expiration / expirationDate / expDate / expiry
//   qualifyingUpcs (semicolon or pipe separated)
//   minQty / minimumQuantity
//   requiresMultipack (Y / N / true / false)
//   displayName / name
export const importCouponsCsv = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, error: 'rows[] is required' });
    }

    // Build a code → manufacturer ID lookup
    const mfrs = await prisma.tobaccoManufacturer.findMany({
      where: { active: true },
      select: { id: true, code: true, brandFamilies: true },
    });
    const mfrByCode = Object.fromEntries(mfrs.map((m) => [m.code, m]));

    // Lower-case header lookup helper
    const get = (row, ...keys) => {
      for (const k of keys) {
        const lk = Object.keys(row).find((rk) => rk.toLowerCase() === k.toLowerCase());
        if (lk && row[lk] != null && row[lk] !== '') return String(row[lk]).trim();
      }
      return null;
    };

    const results = { created: 0, updated: 0, skipped: 0, errors: [] };

    for (const [i, row] of rows.entries()) {
      try {
        const serial = get(row, 'serial', 'serialnumber', 'serial_number');
        const mfrCode = get(row, 'manufacturer', 'manufacturercode', 'mfr');
        const brand = get(row, 'brand', 'brandfamily', 'family');
        const dType = get(row, 'discounttype', 'type');
        const dAmt = get(row, 'discountamount', 'amount', 'value');
        const expDate = get(row, 'expiration', 'expirationdate', 'expdate', 'expiry');

        if (!serial || !mfrCode || !brand || !dType || !dAmt || !expDate) {
          results.skipped++;
          results.errors.push({ row: i + 1, error: 'Missing required column (serial/manufacturer/brand/discountType/discountAmount/expiration)' });
          continue;
        }

        const mfr = mfrByCode[mfrCode];
        if (!mfr) {
          results.skipped++;
          results.errors.push({ row: i + 1, serial, error: `Unknown manufacturer code: ${mfrCode}` });
          continue;
        }
        if (!['fixed', 'percent'].includes(dType.toLowerCase())) {
          results.skipped++;
          results.errors.push({ row: i + 1, serial, error: `Invalid discountType: ${dType}` });
          continue;
        }

        const upcsRaw = get(row, 'qualifyingupcs', 'upcs');
        const upcs = upcsRaw ? upcsRaw.split(/[;|,]/).map((s) => s.trim()).filter(Boolean) : [];

        const data = {
          orgId,
          manufacturerId:    mfr.id,
          serialNumber:      serial,
          displayName:       get(row, 'displayname', 'name'),
          brandFamily:       brand,
          discountType:      dType.toLowerCase(),
          discountAmount:    Number(dAmt),
          expirationDate:    new Date(expDate),
          qualifyingUpcs:    upcs,
          minQty:            Number(get(row, 'minqty', 'minimumquantity')) || 1,
          requiresMultipack: ['y', 'yes', 'true', '1'].includes((get(row, 'requiresmultipack') || 'n').toLowerCase()),
          maxPerTx:          num(get(row, 'maxpertx')),
          maxPerCoupon:      num(get(row, 'maxpercoupon')) || 1,
          fundedBy:          (get(row, 'fundedby') || 'manufacturer').toLowerCase() === 'retailer' ? 'retailer' : 'manufacturer',
          createdById:       req.user?.id || null,
          importedFrom:      'csv',
        };

        const existing = await prisma.manufacturerCoupon.findUnique({ where: { serialNumber: serial } });
        if (existing) {
          // Only update if it belongs to this org (or is platform-wide)
          if (existing.orgId && existing.orgId !== orgId) {
            results.skipped++;
            results.errors.push({ row: i + 1, serial, error: 'Coupon belongs to another org' });
            continue;
          }
          const { orgId: _ignore, ...updateData } = data;
          await prisma.manufacturerCoupon.update({ where: { id: existing.id }, data: updateData });
          results.updated++;
        } else {
          await prisma.manufacturerCoupon.create({ data });
          results.created++;
        }
      } catch (err) {
        results.errors.push({ row: i + 1, error: err.message });
      }
    }

    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════
// VALIDATION  (Session 46 — runtime check at POS)
//
// POST /api/coupons/validate
//   Body: { serial, cartItems: [{lineId, upc, qty, lineTotal}], existingSerials: [serial...] }
//   Returns: {
//     valid: boolean,
//     reason?: string,                       // populated when invalid
//     coupon?: { id, serial, brandFamily, manufacturerId, discountType, discountAmount, displayName },
//     qualifyingLines: [{lineId, upc, qty}], // lines in cart this coupon could attach to
//     computedDiscount: number,              // $ amount that would be applied (clamped)
//     requiresApproval: boolean,             // true → POS shows manager-PIN gate
//     approvalReason: string | null,         // e.g. "Coupon value exceeds $5 threshold"
//   }
//
// Threshold logic uses store.pos JSON:
//   couponMaxValueWithoutMgr   — single-coupon $ ceiling
//   couponMaxTotalWithoutMgr   — cumulative tx coupon $ ceiling
//   couponMaxCountWithoutMgr   — coupon-count-per-tx ceiling
// ══════════════════════════════════════════════════════════════════════════

export const validateCoupon = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const storeId = req.headers['x-store-id'] || req.storeId;
    const { serial, cartItems = [], existingSerials = [] } = req.body || {};

    if (!serial) {
      return res.status(400).json({ success: false, error: 'serial is required' });
    }

    const trimmedSerial = String(serial).trim();

    // 1. Already used in this transaction
    if (existingSerials.includes(trimmedSerial)) {
      return res.json({
        success: true, valid: false,
        reason: 'This coupon has already been applied to the current transaction.',
      });
    }

    // 2. Find the coupon (org-scoped + platform-wide)
    const coupon = await prisma.manufacturerCoupon.findFirst({
      where: { serialNumber: trimmedSerial, OR: [{ orgId }, { orgId: null }] },
      include: { manufacturer: true },
    });
    if (!coupon) {
      return res.json({
        success: true, valid: false,
        reason: 'Coupon not found in catalog. Add it under Scan Data → Coupons before redeeming.',
      });
    }

    // 3. Active flag
    if (!coupon.active) {
      return res.json({ success: true, valid: false, reason: 'This coupon has been deactivated.' });
    }

    // 4. Date window
    const now = new Date();
    if (coupon.effectiveDate && new Date(coupon.effectiveDate) > now) {
      return res.json({
        success: true, valid: false,
        reason: `Not valid until ${new Date(coupon.effectiveDate).toLocaleDateString()}.`,
      });
    }
    if (new Date(coupon.expirationDate) < now) {
      return res.json({
        success: true, valid: false,
        reason: `Expired ${new Date(coupon.expirationDate).toLocaleDateString()}.`,
      });
    }

    // 5. Find qualifying lines in cart
    let qualifyingLines = [];
    if (coupon.qualifyingUpcs && coupon.qualifyingUpcs.length > 0) {
      // Explicit UPC list — match exact
      const upcSet = new Set(coupon.qualifyingUpcs.map(String));
      qualifyingLines = cartItems.filter((it) => it.upc && upcSet.has(String(it.upc)));
    } else {
      // No explicit UPCs → fall back to brand-family tobacco product mapping
      const upcs = cartItems.map((it) => String(it.upc)).filter(Boolean);
      if (upcs.length > 0) {
        const matches = await prisma.tobaccoProductMap.findMany({
          where: {
            orgId,
            manufacturerId: coupon.manufacturerId,
            brandFamily: coupon.brandFamily,
            masterProduct: { upc: { in: upcs } },
          },
          include: { masterProduct: { select: { upc: true } } },
        });
        const matchedUpcs = new Set(matches.map((m) => m.masterProduct.upc));
        qualifyingLines = cartItems.filter((it) => matchedUpcs.has(String(it.upc)));
      }
    }

    if (qualifyingLines.length === 0) {
      return res.json({
        success: true, valid: false,
        reason: `No qualifying ${coupon.brandFamily} product in cart.`,
        coupon: {
          id: coupon.id, serial: coupon.serialNumber, brandFamily: coupon.brandFamily,
          discountAmount: coupon.discountAmount, discountType: coupon.discountType,
        },
      });
    }

    // 6. Multipack / minQty check
    const totalQty = qualifyingLines.reduce((s, l) => s + Number(l.qty || 0), 0);
    if (coupon.requiresMultipack && totalQty < coupon.minQty) {
      return res.json({
        success: true, valid: false,
        reason: `Coupon requires ${coupon.minQty} qualifying items in cart (currently ${totalQty}).`,
      });
    }

    // 7. Per-coupon serial cap (most coupons single-use; track via DB redemption count)
    const priorRedemptions = await prisma.couponRedemption.count({
      where: { couponSerial: trimmedSerial, orgId },
    });
    if (coupon.maxPerCoupon && priorRedemptions >= coupon.maxPerCoupon) {
      return res.json({
        success: true, valid: false,
        reason: 'This coupon has already been redeemed the maximum number of times.',
      });
    }

    // 8. Compute discount value (clamped to qualifying line total)
    const qualifyingLineTotal = qualifyingLines.reduce((s, l) => s + Number(l.lineTotal || 0), 0);
    let computedDiscount = 0;
    if (coupon.discountType === 'percent') {
      computedDiscount = Math.min(qualifyingLineTotal * Number(coupon.discountAmount) / 100, qualifyingLineTotal);
    } else {
      computedDiscount = Math.min(Number(coupon.discountAmount), qualifyingLineTotal);
    }
    computedDiscount = Math.round(computedDiscount * 100) / 100;

    // 9. Threshold check (manager-PIN gate)
    let storeConfig = null;
    if (storeId) {
      const store = await prisma.store.findFirst({ where: { id: storeId, orgId } });
      storeConfig = store?.pos || {};
    }
    const maxVal   = Number(storeConfig?.couponMaxValueWithoutMgr  ?? 5);
    const maxTotal = Number(storeConfig?.couponMaxTotalWithoutMgr  ?? 10);
    const maxCount = Number(storeConfig?.couponMaxCountWithoutMgr  ?? 5);

    let requiresApproval = false;
    let approvalReason   = null;

    if (computedDiscount > maxVal) {
      requiresApproval = true;
      approvalReason = `Coupon value $${computedDiscount.toFixed(2)} exceeds the $${maxVal.toFixed(2)} per-coupon limit.`;
    } else if (existingSerials.length + 1 > maxCount) {
      requiresApproval = true;
      approvalReason = `Adding this coupon would exceed the ${maxCount}-coupon transaction limit.`;
    } else {
      // Cumulative tx total would need to come from the cart (we don't have it here).
      // The cashier-app should ALSO compute the cumulative total locally and gate on
      // maxTotal. We expose maxTotal in the response so the client can do that check.
    }

    return res.json({
      success: true, valid: true,
      coupon: {
        id: coupon.id,
        serial: coupon.serialNumber,
        displayName: coupon.displayName,
        brandFamily: coupon.brandFamily,
        manufacturerId: coupon.manufacturerId,
        manufacturerCode: coupon.manufacturer?.code,
        discountType: coupon.discountType,
        discountAmount: Number(coupon.discountAmount),
        fundedBy: coupon.fundedBy,
        requiresMultipack: coupon.requiresMultipack,
        minQty: coupon.minQty,
      },
      qualifyingLines: qualifyingLines.map((l) => ({
        lineId: l.lineId, upc: l.upc, qty: l.qty, lineTotal: l.lineTotal,
      })),
      computedDiscount,
      requiresApproval,
      approvalReason,
      thresholds: { maxVal, maxTotal, maxCount },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════
// REDEMPTIONS  (read-only in Session 45 — Session 46 ships create-from-POS)
// ══════════════════════════════════════════════════════════════════════════

export const listRedemptions = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { storeId, manufacturerId, status, search, limit } = req.query;

    const where = { orgId };
    if (storeId)        where.storeId = String(storeId);
    if (manufacturerId) where.manufacturerId = String(manufacturerId);
    if (status === 'submitted')   where.submittedAt   = { not: null };
    if (status === 'pending')     where.submittedAt   = null;
    if (status === 'reimbursed')  where.reimbursedAt  = { not: null };
    if (status === 'rejected')    where.rejectedAt    = { not: null };
    if (search) {
      where.OR = [
        { couponSerial: { contains: String(search) } },
        { brandFamily:  { contains: String(search), mode: 'insensitive' } },
        { transactionId: { contains: String(search) } },
      ];
    }

    const rows = await prisma.couponRedemption.findMany({
      where,
      include: {
        coupon: { select: { id: true, serialNumber: true, displayName: true, brandFamily: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: Math.min(Number(limit) || 200, 1000),
    });

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getRedemptionStats = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { storeId, days } = req.query;

    const since = new Date();
    since.setDate(since.getDate() - (Number(days) || 30));

    const where = { orgId, createdAt: { gte: since } };
    if (storeId) where.storeId = String(storeId);

    const [total, submitted, reimbursed, totalAmountAgg] = await Promise.all([
      prisma.couponRedemption.count({ where }),
      prisma.couponRedemption.count({ where: { ...where, submittedAt: { not: null } } }),
      prisma.couponRedemption.count({ where: { ...where, reimbursedAt: { not: null } } }),
      prisma.couponRedemption.aggregate({ where, _sum: { discountApplied: true } }),
    ]);

    res.json({
      success: true,
      data: {
        total,
        submitted,
        reimbursed,
        pending: total - submitted,
        totalAmount: Number(totalAmountAgg._sum.discountApplied || 0),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
