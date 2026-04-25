/**
 * seedEcom.js — Seeds EcomStore, EcomProducts, EcomDepartments, EcomOrders,
 * and EcomCustomers into the ecom-backend DB for every POS store that exists.
 *
 * Reads POS data via a secondary Prisma client pointing at the POS DATABASE_URL
 * (from backend/.env), then writes ecom rows into the current ecom DB.
 *
 * Idempotent per-store.
 *
 * Usage: node ecom-backend/prisma/seedEcom.js
 */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Read POS DB URL from backend/.env
function loadPosDbUrl() {
  const envPath = path.resolve(__dirname, '..', '..', 'backend', '.env');
  if (!fs.existsSync(envPath)) return null;
  const content = fs.readFileSync(envPath, 'utf8');
  const line = content.split('\n').find(l => l.startsWith('DATABASE_URL='));
  return line ? line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : null;
}

const ecom = new PrismaClient();
const posDbUrl = loadPosDbUrl();
// Use raw SQL against POS DB — ecom-backend's Prisma schema has no Store model.
// We borrow the ecom client's PG driver by overriding the datasource URL.
let posClient = null;
async function getPosClient() {
  if (!posDbUrl) return null;
  if (posClient) return posClient;
  posClient = new PrismaClient({ datasources: { db: { url: posDbUrl } } });
  return posClient;
}
async function posQuery(sql, params = []) {
  const c = await getPosClient();
  if (!c) return [];
  // $queryRawUnsafe with parameterized values — Prisma converts to pg query
  return c.$queryRawUnsafe(sql, ...params);
}

const rand    = (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
const pick    = (a) => a[Math.floor(Math.random() * a.length)];
const daysAgo = (n) => new Date(Date.now() - n * 86400000);
const nanoid  = () => Math.random().toString(36).slice(2, 10);

const CUSTOMER_SEED = [
  { firstName: 'Emily',   lastName: 'Anderson',  email: 'emily.anderson@example.com',   phone: '+12075551001' },
  { firstName: 'Michael', lastName: 'Brown',     email: 'michael.brown@example.com',    phone: '+12075551002' },
  { firstName: 'Sarah',   lastName: 'Clark',     email: 'sarah.clark@example.com',      phone: '+12075551003' },
  { firstName: 'David',   lastName: 'Davis',     email: 'david.davis@example.com',      phone: '+12075551004' },
  { firstName: 'Jessica', lastName: 'Evans',     email: 'jessica.evans@example.com',    phone: '+12075551005' },
  { firstName: 'James',   lastName: 'Foster',    email: 'james.foster@example.com',     phone: '+12075551006' },
  { firstName: 'Linda',   lastName: 'Garcia',    email: 'linda.garcia@example.com',     phone: '+12075551007' },
  { firstName: 'Robert',  lastName: 'Hernandez', email: 'robert.hernandez@example.com', phone: '+12075551008' },
];

async function seedForStore(posStore) {
  const { id: posStoreId, orgId, name, timezone } = posStore;
  const slug = (name || 'store').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || `store-${posStoreId.slice(0, 6)}`;

  // 1) Upsert EcomStore
  const existingStore = await ecom.ecomStore.findUnique({ where: { storeId: posStoreId } });
  const store = existingStore || await ecom.ecomStore.create({
    data: {
      orgId, storeId: posStoreId,
      storeName: name || 'Online Store',
      slug: existingStore?.slug || (await isSlugFree(slug) ? slug : `${slug}-${nanoid().slice(0, 4)}`),
      enabled: true,
      timezone: timezone || 'America/New_York',
      branding: {
        logoText: name || 'Storeveu Shop',
        primaryColor: '#3d56b5',
        secondaryColor: '#7b95e0',
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      seoDefaults: {
        metaTitle: `${name || 'Storeveu Shop'} — Online Ordering`,
        metaDescription: `Shop ${name || 'our store'} online and pick up in-store or get delivery.`,
      },
      socialLinks: { instagram: '', facebook: '', twitter: '' },
      fulfillmentConfig: {
        pickupEnabled: true,
        deliveryEnabled: true,
        pickupHours: 'Mon-Sun 8am-9pm',
        deliveryZones: ['04101', '04102', '04103'],
        minOrderAmount: 15,
      },
    },
  });
  if (!existingStore) console.log(`    ↳ EcomStore created: ${store.slug}`);

  // 2) Departments — clone 8 from POS
  const posDepts = await posQuery(
    'SELECT id, code, name, description, color, "sortOrder" FROM departments WHERE "orgId" = $1 ORDER BY "sortOrder" ASC LIMIT 8',
    [orgId],
  );
  for (const d of posDepts) {
    const deptId = Number(d.id); // Raw queries may return BigInt
    const sortOrder = Number(d.sortOrder ?? 0);
    const exists = await ecom.ecomDepartment.findFirst({ where: { storeId: posStoreId, posDepartmentId: deptId } });
    if (exists) continue;
    const baseSlug = (d.code || d.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30) || `dept-${deptId}`;
    try {
      await ecom.ecomDepartment.create({
        data: {
          orgId, storeId: posStoreId,
          posDepartmentId: deptId,
          name: d.name, description: d.description,
          sortOrder,
          visible: true,
          slug: baseSlug,
        },
      });
    } catch (e) {
      // On unique-slug conflict, fall back to a suffixed slug
      if (String(e.message).includes('Unique constraint')) {
        await ecom.ecomDepartment.create({
          data: {
            orgId, storeId: posStoreId,
            posDepartmentId: deptId,
            name: d.name, description: d.description,
            sortOrder, visible: true,
            slug: `${baseSlug}-${deptId}`,
          },
        }).catch(() => {});
      } else {
        console.log(`    ⚠ Failed to clone dept ${d.name}: ${e.message.slice(0, 200)}`);
      }
    }
  }

  // 3) Products — clone top 40 products with a price
  const posProducts = await posQuery(
    `SELECT id, name, brand, upc, size, "defaultRetailPrice", "imageUrl", "departmentId", "taxClass"
     FROM master_products
     WHERE "orgId" = $1 AND active = true AND deleted = false AND "defaultRetailPrice" > 0
     ORDER BY "createdAt" DESC LIMIT 40`,
    [orgId],
  );
  for (const p of posProducts) {
    const pid = Number(p.id);
    const deptIdInt = p.departmentId != null ? Number(p.departmentId) : null;
    const exists = await ecom.ecomProduct.findFirst({ where: { storeId: posStoreId, posProductId: pid } });
    if (exists) continue;
    const dept = deptIdInt ? await ecom.ecomDepartment.findFirst({ where: { storeId: posStoreId, posDepartmentId: deptIdInt } }) : null;
    const slug = String(p.name || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) + '-' + pid;
    try {
      await ecom.ecomProduct.create({
        data: {
          orgId, storeId: posStoreId,
          posProductId: pid,
          name: p.name, brand: p.brand, size: p.size,
          slug,
          retailPrice: p.defaultRetailPrice,
          imageUrl: p.imageUrl,
          departmentSlug: dept?.slug || null,
          departmentName: dept?.name || null,
          taxClass: p.taxClass || null,
          visible: true,
          inStock: true,
          quantityOnHand: rand(5, 80),
          description: `${p.name}${p.brand ? ` by ${p.brand}` : ''}${p.size ? ` — ${p.size}` : ''}. Order online for pickup or delivery.`,
        },
      });
    } catch (e) {
      if (!String(e.message).includes('Unique constraint')) {
        console.log(`\n⚠ Failed to clone product ${p.name}:\n${e.message}\n`);
        break;
      }
    }
  }

  // 4) Customers (8 per store)
  for (const c of CUSTOMER_SEED) {
    const email = `${c.firstName.toLowerCase()}.${c.lastName.toLowerCase()}+${slug}@example.com`;
    const exists = await ecom.ecomCustomer.findUnique({ where: { storeId_email: { storeId: posStoreId, email } } }).catch(() => null);
    if (exists) continue;
    await ecom.ecomCustomer.create({
      data: {
        orgId, storeId: posStoreId,
        email,
        name: `${c.firstName} ${c.lastName}`,
        firstName: c.firstName,
        lastName:  c.lastName,
        phone:     c.phone,
        addresses: [
          { label: 'Home', street: `${rand(10, 999)} Main St`, city: 'Portland', state: 'ME', zip: '04101', country: 'USA' },
        ],
        orderCount: 0,
        totalSpent: 0,
      },
    });
  }

  // 5) Orders — 15 across statuses + realistic totals
  const existingOrders = await ecom.ecomOrder.count({ where: { storeId: posStoreId } });
  if (existingOrders >= 10) {
    console.log(`    ↳ ${existingOrders} orders already exist — skipping`);
    return;
  }
  const products = await ecom.ecomProduct.findMany({ where: { storeId: posStoreId }, take: 30 });
  const customers = await ecom.ecomCustomer.findMany({ where: { storeId: posStoreId }, take: 8 });
  if (products.length === 0 || customers.length === 0) {
    console.log('    ↳ No products/customers to build orders — skipping');
    return;
  }
  const statuses = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'completed', 'completed', 'cancelled', 'pending', 'preparing', 'ready', 'completed', 'completed', 'completed'];
  const stamp = Date.now().toString(36).slice(-5).toUpperCase();
  let orderCount = 0;
  for (let i = 0; i < statuses.length; i++) {
    const status = statuses[i];
    const c = pick(customers);
    const fulfill = pick(['pickup', 'pickup', 'delivery']);
    const nLines = rand(1, 5);
    const lineItems = [];
    let subtotal = 0;
    for (let k = 0; k < nLines; k++) {
      const p = pick(products);
      const qty = rand(1, 3);
      const price = Number(p.retailPrice);
      const total = qty * price;
      subtotal += total;
      lineItems.push({ productId: p.id, name: p.name, qty, price, total, imageUrl: p.imageUrl });
    }
    const taxTotal = Math.round(subtotal * 0.055 * 100) / 100;
    const deliveryFee = fulfill === 'delivery' ? 4.99 : 0;
    const tipAmount = status === 'completed' ? Math.round(subtotal * pick([0.10, 0.15, 0.18]) * 100) / 100 : 0;
    const grandTotal = Math.round((subtotal + taxTotal + deliveryFee + tipAmount) * 100) / 100;
    const daysBack = rand(0, 14);
    const orderDate = daysAgo(daysBack);

    await ecom.ecomOrder.create({
      data: {
        orgId, storeId: posStoreId,
        orderNumber: `ORD-${orderDate.toISOString().slice(0, 10).replace(/-/g, '')}-${stamp}${String(i).padStart(3, '0')}`,
        status,
        fulfillmentType: fulfill,
        customerName:  c.name || `${c.firstName} ${c.lastName}`,
        customerEmail: c.email,
        customerPhone: c.phone,
        customerId:    c.id,
        shippingAddress: fulfill === 'delivery' ? { street: `${rand(10, 999)} Maple Ave`, city: 'Portland', state: 'ME', zip: '04101', instructions: pick(['Leave at door', 'Ring bell', null]) } : null,
        lineItems,
        subtotal,
        taxTotal,
        deliveryFee,
        tipAmount,
        grandTotal,
        paymentStatus: status === 'cancelled' ? 'refunded' : (status === 'pending' ? 'pending' : 'paid'),
        paymentMethod: pick(['card', 'card', 'cash_on_pickup']),
        confirmedAt: status !== 'pending' && status !== 'cancelled' ? new Date(orderDate.getTime() + 5 * 60000) : null,
        completedAt: status === 'completed' ? new Date(orderDate.getTime() + 3 * 3600000) : null,
        cancelledAt: status === 'cancelled' ? new Date(orderDate.getTime() + 30 * 60000) : null,
        cancelReason: status === 'cancelled' ? 'Customer requested cancellation' : null,
        notes: i % 4 === 0 ? 'Please call on arrival' : null,
        createdAt: orderDate,
        updatedAt: orderDate,
      },
    });
    orderCount++;
  }

  // 6) Update customer stats from orders
  for (const c of customers) {
    const agg = await ecom.ecomOrder.aggregate({
      where: { storeId: posStoreId, customerId: c.id, status: { not: 'cancelled' } },
      _count: true, _sum: { grandTotal: true },
      _max: { createdAt: true },
    });
    await ecom.ecomCustomer.update({
      where: { id: c.id },
      data: {
        orderCount: agg._count || 0,
        totalSpent: agg._sum.grandTotal || 0,
        lastOrderAt: agg._max.createdAt,
      },
    });
  }

  console.log(`    ↳ ${posDepts.length} depts, ${posProducts.length} products, ${customers.length} customers, ${orderCount} orders`);
}

async function isSlugFree(slug) {
  const x = await ecom.ecomStore.findUnique({ where: { slug } });
  return !x;
}

async function main() {
  console.log('\n  🛒 Seeding e-commerce data...');

  if (!posDbUrl) {
    console.log('  ⚠ Could not read POS DATABASE_URL from backend/.env — skipping');
    return;
  }

  const stores = await posQuery(
    `SELECT s.id, s."orgId", s.name, s.timezone
     FROM stores s
     JOIN organizations o ON o.id = s."orgId"
     WHERE s."isActive" = true AND o.slug <> 'system'
     ORDER BY s."createdAt" ASC`,
  );

  for (const s of stores) {
    console.log(`\n  ↳ ${s.name} (${s.id})`);
    await seedForStore(s);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((e) => { console.error('✗ seedEcom failed:', e); process.exit(1); })
    .finally(async () => {
      await ecom.$disconnect();
      if (posClient) await posClient.$disconnect();
    });
}

export { main as seedEcom };
