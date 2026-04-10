/**
 * Label Queue Service
 *
 * Manages a queue of product labels that need to be printed due to
 * price changes, new products, sales, or manual requests.
 */

import prisma from '../config/postgres.js';

// ── Helper: safe upsert that handles nullable storeId ─────────────────────
// Prisma can't use compound unique with null values in upsert where clause,
// so we do a findFirst + create/update pattern instead.
async function upsertQueueItem(orgId, storeId, productId, data) {
  const existing = await prisma.labelQueue.findFirst({
    where: {
      orgId,
      storeId: storeId || null,
      masterProductId: productId,
      status: 'pending',
    },
  });

  if (existing) {
    return prisma.labelQueue.update({
      where: { id: existing.id },
      data: {
        reason:   data.reason,
        oldPrice: data.oldPrice,
        newPrice: data.newPrice,
        addedAt:  new Date(),
      },
    });
  }

  return prisma.labelQueue.create({
    data: {
      orgId,
      storeId:         storeId || null,
      masterProductId: productId,
      reason:          data.reason,
      oldPrice:        data.oldPrice,
      newPrice:        data.newPrice,
      status:          'pending',
    },
  });
}

// ─────────────────────────────────────────────────
// 1. Queue label for a price change
// ─────────────────────────────────────────────────

export const queueLabelForPriceChange = async (orgId, storeId, productId, oldPrice, newPrice) => {
  if (oldPrice != null && newPrice != null && parseFloat(oldPrice) === parseFloat(newPrice)) return null;
  return upsertQueueItem(orgId, storeId, productId, {
    reason:   'price_change',
    oldPrice: oldPrice != null ? parseFloat(oldPrice) : null,
    newPrice: newPrice != null ? parseFloat(newPrice) : null,
  });
};

// ─────────────────────────────────────────────────
// 2. Queue label for a new product
// ─────────────────────────────────────────────────

export const queueLabelForNewProduct = async (orgId, productId, retailPrice) => {
  return upsertQueueItem(orgId, null, productId, {
    reason:   'new_product',
    oldPrice: null,
    newPrice: retailPrice != null ? parseFloat(retailPrice) : null,
  });
};

// ─────────────────────────────────────────────────
// 3. Queue label for a sale starting/ending
// ─────────────────────────────────────────────────

export const queueLabelForSale = async (orgId, storeId, productId, regularPrice, salePrice, isSaleEnding) => {
  return upsertQueueItem(orgId, storeId, productId, {
    reason:   isSaleEnding ? 'sale_ended' : 'sale_started',
    oldPrice: regularPrice != null ? parseFloat(regularPrice) : null,
    newPrice: salePrice != null ? parseFloat(salePrice) : null,
  });
};

// ─────────────────────────────────────────────────
// 4. Add manual item(s) to the queue
// ─────────────────────────────────────────────────

export const addManualItem = async (orgId, storeId, productId) => {
  const product = await prisma.masterProduct.findFirst({
    where: { id: productId, orgId },
    select: { defaultRetailPrice: true },
  });

  return upsertQueueItem(orgId, storeId, productId, {
    reason:   'manual',
    oldPrice: null,
    newPrice: product?.defaultRetailPrice ? parseFloat(product.defaultRetailPrice) : null,
  });
};

// ─────────────────────────────────────────────────
// 5. Get label queue (pending items with product details)
// ─────────────────────────────────────────────────

export const getLabelQueue = async (orgId, storeId, filters = {}) => {
  const where = { orgId, status: filters.status || 'pending' };

  // Include org-wide items (storeId=null) + store-specific
  if (storeId) {
    where.OR = [{ storeId }, { storeId: null }];
    // Move orgId and status inside AND to avoid conflict with OR
    delete where.orgId;
    delete where.status;
    where.AND = [
      { orgId },
      { status: filters.status || 'pending' },
    ];
  }

  if (filters.reason) where.reason = filters.reason;

  if (filters.search) {
    const searchFilter = {
      product: {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { upc:  { contains: filters.search, mode: 'insensitive' } },
          { brand:{ contains: filters.search, mode: 'insensitive' } },
        ],
      },
    };
    if (where.AND) where.AND.push(searchFilter);
    else where.AND = [searchFilter];
  }

  const items = await prisma.labelQueue.findMany({
    where,
    include: {
      product: {
        select: {
          id: true, name: true, upc: true, brand: true,
          size: true, sizeUnit: true,
          defaultRetailPrice: true, defaultCostPrice: true,
          department: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ addedAt: 'desc' }],
    take: 500,
  });

  // Group by reason
  const groups = {
    price_change: items.filter(i => i.reason === 'price_change'),
    new_product:  items.filter(i => i.reason === 'new_product'),
    sale_started: items.filter(i => i.reason === 'sale_started'),
    sale_ended:   items.filter(i => i.reason === 'sale_ended'),
    manual:       items.filter(i => i.reason === 'manual'),
  };

  return { items, groups, total: items.length };
};

// ─────────────────────────────────────────────────
// 6. Get pending count (for badge)
// ─────────────────────────────────────────────────

export const getQueueCount = async (orgId, storeId) => {
  const where = { orgId, status: 'pending' };
  if (storeId) {
    delete where.orgId;
    delete where.status;
    where.AND = [{ orgId }, { status: 'pending' }];
    where.OR = [{ storeId }, { storeId: null }];
  }
  return prisma.labelQueue.count({ where });
};

// ─────────────────────────────────────────────────
// 7. Mark items as printed
// ─────────────────────────────────────────────────

export const markAsPrinted = async (ids, userId) => {
  const intIds = ids.map(id => parseInt(id));

  // First, clear any old printed/dismissed entries for these products
  // to avoid unique constraint conflict (orgId, storeId, productId, status)
  const pending = await prisma.labelQueue.findMany({
    where: { id: { in: intIds } },
    select: { orgId: true, storeId: true, masterProductId: true },
  });

  if (pending.length > 0) {
    for (const p of pending) {
      await prisma.labelQueue.deleteMany({
        where: {
          orgId: p.orgId,
          storeId: p.storeId,
          masterProductId: p.masterProductId,
          status: { in: ['printed', 'dismissed'] },
        },
      }).catch(() => {});
    }
  }

  return prisma.labelQueue.updateMany({
    where: { id: { in: intIds } },
    data: { status: 'printed', printedAt: new Date(), printedBy: userId },
  });
};

// ─────────────────────────────────────────────────
// 8. Dismiss items
// ─────────────────────────────────────────────────

export const dismissItems = async (ids) => {
  const intIds = ids.map(id => parseInt(id));

  // Clear old dismissed entries to avoid unique constraint conflict
  const pending = await prisma.labelQueue.findMany({
    where: { id: { in: intIds } },
    select: { orgId: true, storeId: true, masterProductId: true },
  });

  for (const p of pending) {
    await prisma.labelQueue.deleteMany({
      where: {
        orgId: p.orgId,
        storeId: p.storeId,
        masterProductId: p.masterProductId,
        status: 'dismissed',
      },
    }).catch(() => {});
  }

  return prisma.labelQueue.updateMany({
    where: { id: { in: intIds } },
    data: { status: 'dismissed' },
  });
};

// ─────────────────────────────────────────────────
// 9. Clear old printed/dismissed items
// ─────────────────────────────────────────────────

export const clearOldItems = async (orgId, daysOld = 30) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  return prisma.labelQueue.deleteMany({
    where: {
      orgId,
      status: { in: ['printed', 'dismissed'] },
      addedAt: { lt: cutoff },
    },
  });
};
