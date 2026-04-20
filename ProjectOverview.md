# Storeveu POS Platform — Project Overview

The Storeveu POS Platform is a comprehensive, **multi-org** POS and management ecosystem designed for retail, convenience, grocery, and liquor store operations. It bridges the gap between traditional IT Retail systems and modern cloud-based analytics, providing real-time visibility, advanced forecasting, and full hardware integration.

> For the full session-by-session engineering log, see [`CLAUDE.md`](CLAUDE.md). This file is the high-level human-facing overview.

---

## 🧩 Modules (at a glance)

| Module | Status | Notes |
|--------|--------|-------|
| **POS Terminal (cashier-app)** | Production | Electron/PWA, offline-first, hardware integration |
| **Management Portal** | Production | React 19, permission-gated sidebar |
| **Admin Panel (superadmin)** | Production | Standalone app on :5175, separate `admin_user` localStorage |
| **E-Commerce Module** | Production | Next.js storefront + ecom-backend, see `ECOMMERCE_GUIDE.md` |
| **Lottery Module** | Production | State-scoped games, EOD scan reconciliation, commission reports |
| **Fuel Module** | Production (Session 23) | Per-store fuel types, sale/refund, EoD fuel section |
| **Invoice OCR** | Production | Vendor-scoped itemCode matching, live totals, cases/units toggle — see `Invoice-Processing-Architecture.md` |
| **Vendor Orders (14-factor)** | Production | Demand-driven auto-reorder, Holt-Winters + weather + stockout penalty |
| **RBAC** | Production (Sessions 30–31) | 133-key permission catalog, 5-layer enforcement |
| **Multi-Org Access** | Production (Sessions 32–35) | One login → many orgs, 7-day email invitations, store ownership transfer |
| **Quick Buttons WYSIWYG** | Production (Session 37) | Freeform drag-resize tile builder, 1-level folders, 19 action types |
| **Product Image System** | Production (Session 29) | `GlobalProductImage` cache keyed by stripped UPC, image re-hosting |

---

## 🗺️ System Map (Sidebar Navigation)

| Category | Module | Status | Description |
| :--- | :--- | :--- | :--- |
| **Operations** | `Live Dashboard` | Active | Today's sales + weather (Auto-refresh) |
| | `Customers` | Active | CRM, Loyalty points, House Accounts |
| | `Invoice Import` | Active | AI-powered PDF/Image OCR processing |
| | `CSV Transformer`| Active | Legacy vendor file format conversion |
| | `Bulk Import` | Active | CSV/Excel product import pipeline |
| **Catalog** | `Products` | Active | **Native PostgreSQL Catalog** management |
| | `Departments` | Active | Sales & Tax class groupings |
| | `Vendors` | Active | Supplier management with aliases |
| | `Promotions` | Active | BOGO, volume, combo, mix & match deals |
| | `Fees & Deposits`| Active | Service fees, CRV/bottle deposit mapping |
| **Analytics** | `Sales` | Active | Daily/Weekly/Monthly/Yearly charts |
| | `Departments` | Active | Department-level comparison |
| | `Products` | Active | Movement analysis & top-sellers |
| | `Predictions` | Active | Holt-Winters triple exponential forecasting |
| **Lottery** | `Games` | Active | State-scoped scratch ticket game catalog |
| | `Inventory` | Active | Box receiving, activation, depletion |
| | `Shift Reports` | Active | EOD ticket scan reconciliation |
| | `Commission` | Active | Store-level commission reporting |
| **Integrations** | `POS API` | Active | MarktPOS v2 live search & credentials |
| | `Vendor Orders` | Active | Automated reordering recommendations |
| | `PAX Payments` | Active | Card terminal integration (sale/refund/void) |
| | `eComm` | Active | Online storefront & delivery integration (Next.js + ecom-backend) |
| **Point of Sale** | `POS Settings` | Active | Terminal layout, Quick-keys, & behavior |
| | `Receipt Settings`| Active | Per-store receipt configuration |
| | `Branding` | Active | Logo, Colors, & Themes |
| | `Stations` | Active | Register terminal + hardware config |
| | `Transactions` | Active | Real-time POS log audit trail |
| **Account** | `Employee Reports`| Active | Comprehensive sales stats per staff member |
| | `Organisation` | Active | Multi-tenant billing & global settings |
| | `Users` | Active | Role-based access control (RBAC) |
| | `Stores` | Active | Multi-location setup & geo-mapping |

---

## 🛠️ Feature Breakdown

### 1. Operations: Native POS Catalog
The system maintains a high-performance **PostgreSQL** shadow catalog of the entire store inventory. This enables instant search, bulk pricing updates, and rich metadata (EBT eligible, Bottle deposits) that may be missing from the primary POS system.

### 2. Operations: Invoice OCR Import
A custom-built hybrid OCR pipeline. Azure Document Intelligence handles the initial layout extraction from vendor PDFs, while GPT-4o-mini Vision identifies complex column headers and matches them to the POS catalog using a 6-tier matching algorithm.

### 3. Analytics: Weather-Correlated Sales
The only retail portal that merges historical weather data (temp, precipitation, WMO code) with sales figures. This helps managers understand why sales fluctuated (e.g., "Beer sales dropped 30% because of the storm") and prepare for upcoming weather events.

### 4. Analytics: Holt-Winters Predictions
Advanced time-series forecasting. The triple exponential smoothing model accounts for level, trend, and seasonality, boosted by Day-of-Week (DOW) adjustment factors to handle weekend surges accurately.

### 5. Point of Sale: Cashier Terminal (Electron + PWA)
A full-featured, offline-first POS terminal available as an Electron desktop app (Windows) or PWA.
- **Offline Sync:** Uses Dexie (IndexedDB) to store thousands of products locally.
- **PIN Login:** Fast cashier switching via 4-6 digit PIN (offline-capable via cached PIN hashes).
- **Electron Desktop:** Native Windows app with USB/network receipt printing, cash drawer, barcode scanner, and scale support.
- **Hardware Integration:** ESC/POS receipt printers, ZPL label printers, PAX payment terminals, Magellan scales.
- **Lottery Module:** Integrated scratch-ticket sales, payouts, and EOD box reconciliation.
- **Hold/Recall:** Unlimited simultaneous parked transactions in IndexedDB.

---

## 🛣️ Roadmap & Future Work

### Completed (Q1-Q2 2026)
- **Lottery Module:** Complete scratch-ticket management (sales, payouts, EOD scans, commission reports).
- **Public Marketing Site:** Responsive 5-page site with interactive UI and centralized navigation.
- **PostgreSQL Migration & Sync:** Moved core data to PostgreSQL and stabilized schema sync via `npx prisma db push`.
- **Multi-Terminal API:** Built the backend infrastructure for the native POS Cashier.
- **Service Fee Engine:** Native management of delivery fees and service charges.
- **Employee Reporting:** Added sub-module for per-cashier sales performance.
- **Hardware Integration:** Full ESC/POS receipt printing (USB/Network/QZ Tray), cash drawer, barcode scanner, weight scale.
- **Electron Desktop App:** Windows x64 NSIS installer with native IPC for USB printing and hardware control.
- **Receipt Settings:** Per-store receipt configuration (paper width, header/footer, print behaviour, branding).
- **PAX Payment Terminal:** Card terminal integration via backend API proxy.
- **Station Hardware Config:** Per-register hardware setup (printer, drawer, scale, PAX) saved to DB + localStorage.
- **CI/CD Pipeline:** GitHub Actions auto-deploy to production on push to main.
- **Offline PIN Auth:** Cashier PIN hashes cached in IndexedDB for offline login.
- **Promotion Engine:** Client-side evaluation (sale, BOGO, volume, mix & match, combo).
- **Bulk Import:** CSV/Excel product import with preview, validation, and commit.

### In Progress (Q3 2026)
- **Offline Batch Sync:** Finalizing the conflict-resolution logic for transactions taken during internet outages.
- **Inventory Variance:** "Theoretical vs. Actual" stock level reporting from invoice data.
- **Lottery Barcode Scanning:** Device camera integration for EOD ticket scanning.

### Completed (Q2 2026)
- **E-Commerce Module:** Full online store with Next.js storefront, product sync from POS, 15 premium templates, customer auth (unified with POS Customer table), checkout with stock check, order management, custom domains, analytics.
- **Admin Panel:** Standalone superadmin app (admin-app/) with user/org/store CRUD, login-as-user impersonation, support tickets, billing management, database backup streaming, product image re-hosting.
- **Unified Customer Auth:** POS Customer table is now single source of truth for both in-store and online storefront authentication.
- **CI/CD with Atomic Deploys:** GitHub Actions pipeline deploys all 6 apps with atomic file swaps and Nginx reload.
- **Fuel Module, RBAC (133 keys), Multi-Org Access, Quick Buttons WYSIWYG, US State catalog, Mobile UPC scanner** — see Modules table above.

### Planned (Q3-Q4 2026)
- **Customer Loyalty Points:** Points-per-dollar model with redemption as tender.
- **Logo on Receipt:** ESC/POS raster graphics (base64 → bitmap).
- **Digital Receipts:** Email/SMS receipt delivery after transaction.
- **Multi-language UI:** i18n support (Spanish, French).
- **Kiosk / Self-Checkout Mode:** Customer-facing UI on second monitor.
