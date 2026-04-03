# Future Foods Portal — Developer Documentation

A multi-tenant business portal and multi-terminal POS system for Future Foods store operations. Covers sales analytics with weather correlation, IT Retail / MarktPOS integration, AI-powered invoice OCR, native PostgreSQL product catalog management, and a lightweight PWA Cashier Terminal for in-store checkout.

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Project Structure](#2-project-structure)
3. [Getting Started](#3-getting-started)
4. [Environment Variables](#4-environment-variables)
5. [Frontend Pages & Routes](#5-frontend-pages--routes)
6. [Backend API Reference](#6-backend-api-reference)
7. [Database Models (Prisma)](#7-database-models-prisma)
8. [Key Services & Utilities](#8-key-services--utilities)
9. [Feature Deep-Dives](#9-feature-deep-dives)
   - [Sales Analytics + Weather](#91-sales-analytics--weather)
   - [Live Dashboard](#92-live-dashboard)
   - [Sales Predictions + Residual Analysis](#93-sales-predictions--residual-analysis)
   - [Invoice OCR Pipeline](#94-invoice-ocr-pipeline)
   - [MarktPOS / IT Retail Integration](#95-marktpos--it-retail-integration)
   - [CSV Transformer](#96-csv-transformer)
10. [Authentication & Authorization](#10-authentication--authorization)
11. [Styling System](#11-styling-system)
12. [Adding a New Page](#12-adding-a-new-page)
13. [Adding a New API Endpoint](#13-adding-a-new-api-endpoint)
14. [Adding a New CSV Vendor](#14-adding-a-new-csv-vendor)
15. [Pending / Future Work](#15-pending--future-work)
16. [Changelog — April 2026](#16-changelog--april-2026)

---

## 1. Tech Stack

| Layer | Technology |
|-------|-----------|
| Portal Frontend | React 19, Vite 7, React Router v6, Redux Toolkit (RTK Query) |
| Cashier Terminal | React 18, Vite 5, Zustand, Dexie (IndexedDB), PWA |
| Charts | Recharts (Dual-axis Sales + Weather) |
| Icons | Lucide React |
| Backend | Node.js, Express 4 |
| Database (Primary) | **PostgreSQL 16 (Prisma 5)** — Core multi-tenant models, native POS catalog, inventory, transactions, users, and customers |
| Database (Legacy) | MongoDB Atlas (Mongoose 8) — Fallback storage for legacy CSV transform data and old logs |
| Auth | JWT (30-day tokens) + bcryptjs (Passwords & POS PINs) |
| File handling | Multer, pdf2pic (PDF preview), csv-parser, fast-csv, xlsx |
| OCR | **Hybrid:** Azure Document Intelligence (prebuilt-invoice) + OpenAI GPT-4o-mini |
| POS | MarktPOS / IT Retail REST API (v2 Integration) |
| Weather | Open-Meteo API |
| Predictions | Holt-Winters Triple Exponential Smoothing with DOW factors |
| Dev tooling | Concurrently, Nodemon, ESLint, Jest |

---

## 2. Project Structure

```
CSV_Filter_Project/
├── .claude/
│   └── launch.json              # Dev server config for Claude Code
│
├── cashier-app/                 # POS Terminal (PWA)
│   ├── src/
│   │   ├── db/dexie.js          # IndexedDB schema for offline catalog
│   │   ├── stores/              # Zustand stores (Auth, Station, Cart)
│   │   └── screens/             # StationSetup, PinLogin, POSScreen
│   └── public/                  # Manifest & Icons for PWA
│
├── frontend/                    # main management portal
│   ├── src/
│   │   ├── App.jsx              # Router — all route definitions live here
│   │   ├── main.jsx             # React entry point
│   │   ├── assets/
│   │   │   └── future-foods-logo.jpg
│   │   ├── components/
│   │   │   ├── Sidebar.jsx      # Navigation sidebar (add new links here)
│   │   │   ├── Layout.jsx       # Wrapper for portal pages
│   │   │   ├── Navbar.jsx
│   │   │   ├── DatePicker.jsx   # Custom calendar picker (no external lib)
│   │   │   ├── DocumentUploader.jsx
│   │   │   └── DocumentHistory.jsx
│   │   ├── pages/
│   │   │   ├── analytics.css    # Shared CSS for all analytics pages
│   │   │   ├── Login.jsx
│   │   │   ├── Signup.jsx
│   │   │   ├── RealTimeDashboard.jsx
│   │   │   ├── SalesAnalytics.jsx
│   │   │   ├── DepartmentAnalytics.jsx
│   │   │   ├── ProductAnalytics.jsx
│   │   │   ├── SalesPredictions.jsx
│   │   │   ├── VendorOrderSheet.jsx
│   │   │   ├── Customers.jsx
│   │   │   ├── ProductCatalog.jsx  # Native PostgreSQL catalog
│   │   │   ├── EmployeeReports.jsx # Backend reporting
│   │   │   ├── POSAPI.jsx
│   │   │   ├── POSSettings.jsx
│   │   │   ├── Organisation.jsx
│   │   │   ├── StoreManagement.jsx
│   │   │   └── UserManagement.jsx
│   │   ├── services/
│   │   │   └── api.js           # All Axios API calls (single source of truth)
│   │   ├── store/
│   │   │   └── slices/
│   │   │       ├── authSlice.js
│   │   │       └── customerSlice.js
│   │   └── utils/
│   │       └── weatherIcons.js  # WMO code → icon/label/emoji + color helpers
│
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma             # PostgreSQL schema (20+ tables)
│   │   └── seed.js                   # Maine tax/deposit/product seeder
│   ├── src/
│   │   ├── server.js            # Express app, middleware, route mounts
│   │   ├── config/
│   │   │   └── postgres.js          # Prisma client singleton
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── catalogController.js  # Native POS catalog CRUD
│   │   │   ├── customerController.js
│   │   │   ├── invoiceController.js
│   │   │   ├── posController.js       # IT Retail Proxy
│   │   │   ├── posTerminalController.js # Cashier Terminal API
│   │   │   └── salesController.js     # Analytics + Predictions
│   │   ├── middleware/
│   │   │   ├── auth.js              # JWT protect + role-based authorize()
│   │   │   └── scopeToTenant.js     # Multi-tenant scoping logic
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── catalogRoutes.js     # /api/catalog — Native SQL catalog
│   │   │   ├── customerRoutes.js
│   │   │   ├── invoiceRoutes.js
│   │   │   ├── posRoutes.js
│   │   │   ├── posTerminalRoutes.js # /api/pos-terminal
│   │   │   ├── productRoutes.js
│   │   │   ├── salesRoutes.js
│   │   │   └── reportsRoutes.js     # /api/reports
│   │   ├── services/
│   │   │   ├── marktPOSService.js    # IT Retail API client
│   │   │   ├── salesService.js       # Sales data fetching
│   │   │   ├── weatherService.js     # Open-Meteo pipeline
│   │   │   └── matchingService.js    # Invoice-to-POS matching
│   │   └── utils/
│   │       ├── predictions.js        # Holt-Winters algos
│   │       ├── fileProcessor.js      # CSV/Excel parsing
│   │       └── posScheduler.js       # MarktPOS token refresh
│   ├── docker-compose.yml            # Local PostgreSQL via Docker
│   └── uploads/                      # Uploaded files (gitignored)
```

---

## 3. Getting Started

### Prerequisites
- Node.js 18+
- **PostgreSQL 16+** — Primary database (managed via Prisma)
- MongoDB Atlas account (for legacy CSV features)
- MarktPOS / IT Retail credentials
- Azure Document Intelligence resource + OpenAI API key

### Install dependencies

```bash
# Root
npm install

# Backend
cd backend
npm install

# Frontend Portal
cd ../frontend
npm install

# Cashier Terminal
cd ../cashier-app
npm install
```

### PostgreSQL Setup

The portal uses **PostgreSQL** for all core operations (Identity, Transactions, Records).

#### Option A — Native Windows
PostgreSQL 16 is installed as a service. Connection details are in `.env`:
- User: `futurefoods`
- Pass: `futurefoods123`
- DB: `futurefoods_portal`

#### Option B — Docker
```bash
cd backend
docker compose up -d
```

### Run migrations

```bash
cd backend
npx prisma generate
npx prisma db push
npm run db:seed -- <orgId>
```

**Current local status — already done:**
- ✓ 22 tables created via Prisma
- ✓ 27 departments seeded
- ✓ 6 Maine tax rules seeded
- ✓ 2 Maine CRV deposit rules seeded
- ✓ 100 sample products seeded

### Run development servers

```bash
# Recommended: One command from root
npm run dev
```
Starts **BACKEND** (:5000), **FRONTEND** (:5173), and **CASHIER** (:5174).

---

## 4. Environment Variables

All variables go in `backend/.env`.

```env
# Server
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173,http://localhost:5174

# Database
DATABASE_URL="postgresql://futurefoods:futurefoods123@localhost:5432/futurefoods_portal"

# Auth
JWT_SECRET=...

# Integrations
OPENAI_API_KEY=...
AZURE_DOCUMENT_INTELLIGENCE_KEY=...
MARKTPOS_USERNAME=...
MARKTPOS_PASSWORD=...
```

---

## 5. Frontend Pages & Routes

Defined in `frontend/src/App.jsx`.

| Route | Component | Description |
|-------|-----------|-------------|
| `/portal/realtime` | `RealTimeDashboard.jsx` | Live today's sales + weather |
| `/portal/sales` | `SalesAnalytics.jsx` | Historical sales + weather trends |
| `/portal/departments`| `DepartmentAnalytics.jsx`| Sales by department |
| `/portal/predictions`| `SalesPredictions.jsx`| Holt-Winters forecasting |
| `/portal/invoice-import`| `InvoiceImport.jsx`| Hybrid OCR Invoice processor |
| `/portal/catalog` | `ProductCatalog.jsx` | Native PostgreSQL product catalog |
| `/portal/catalog/edit/:id`| `ProductForm.jsx` | Unified product editor |
| `/portal/pos-settings`| `POSSettings.jsx`| In-store terminal & layout config |
| `/portal/employee-reports`| `EmployeeReports.jsx`| Sales stats by employee |
| `/portal/branding` | `StoreBranding.jsx` | Station logo/theme management |
| `/portal/users` | `UserManagement.jsx` | RBAC for organization staff |

---

## 6. Backend API Reference

### Catalog (`/api/catalog`) 🔒
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List master products |
| GET | `/products/:id` | Get full product detail |
| POST | `/products` | Create master product |
| PUT | `/products/:id` | Update master product |
| GET | `/departments` | All departments |
| GET | `/tax-rules` | All active tax rules |
| GET | `/deposit-rules`| All bottle deposit rules|

### Cashier Terminal (`/api/pos-terminal`) 🔒
| Method | Path | Description |
|--------|------|-------------|
| GET | `/catalog/snapshot`| Offline-first product list |
| POST | `/transactions` | Record a new sale |
| POST | `/transactions/batch`| Bulk-sync offline sales |
| POST | `/pin-login` | Cashier quick-login |
| GET | `/config` | Get station layout/behavior |
| GET | `/branding` | Get station logo/colors |

### Reports (`/api/reports`) 🔒
| Method | Path | Description |
|--------|------|-------------|
| GET | `/employees` | Get employee sales reports |

---

## 7. Database Models (Prisma)

Core models in `backend/prisma/schema.prisma`:

### Organization (Tenant)
Top-level entity isolation.
```prisma
model Organization {
  id    String @id @default(cuid())
  name  String
  slug  String @unique
  plan  String @default("trial")
}
```

### MasterProduct
Canonical product record shared across all stores in an org.
```prisma
model MasterProduct {
  id           Int     @id @default(autoincrement())
  upc          String?
  name         String
  departmentId Int?
  taxClass     String?
}
```

### Transaction
Native POS sales data recorded by Cashier Terminal.
```prisma
model Transaction {
  id         String   @id @default(cuid())
  txNumber   String
  grandTotal Decimal
  lineItems  Json     // Denormalized snapshot of sale
}
```

---

## 8. Key Services & Utilities

### `weatherService.js`

Three-stage pipeline on every call:

1. **Cache check** — query `WeatherCache` for the requested date range
2. **Fetch missing** — call Open-Meteo archive API (historical) or forecast API (today/future) for any uncached dates
3. **Upsert** — bulk-write new records to MongoDB

Key exports:
```js
fetchWeatherRange(lat, lng, startDate, endDate, timezone)
  // Returns sorted daily weather array, fully cached in MongoDB

getCurrentWeather(lat, lng, timezone)
  // Returns { current: { temperature, condition, icon, windSpeed, humidity },
  //           forecast: [{ date, tempMax, tempMin, precipitation, condition, icon }] }

mergeSalesAndWeather(salesRows, weatherRecords)
  // Joins by date — adds tempHigh/Low/Mean, precipitation, condition to each sales row

aggregateWeatherWeekly(dailyRecords)   // Monday-based ISO weeks
aggregateWeatherMonthly(dailyRecords)  // YYYY-MM buckets
aggregateWeatherYearly(dailyRecords)   // YYYY buckets
```

### `predictions.js`

```js
holtwinters(data, period, alpha, beta, gamma, horizon)
  // Core Holt-Winters Triple Exponential Smoothing
  // Returns forecast number[] of length `horizon`

applyDOWFactors(forecast, startDate)
  // Multiplies daily forecast by day-of-week adjustment factors
  // Sun=×1.15, Mon=×0.90, Tue=×0.88, Wed=×0.92, Thu=×1.00, Fri=×1.20, Sat=×1.30

buildPredictionTimeline(forecastValues, startDate, period)
  // Returns [{ date, dayOfWeek, predicted, isHoliday, holidayName }]

US_HOLIDAYS  // { 'YYYY-MM-DD': 'Holiday Name' } for 2025–2026
```

### `matchingService.js`

Six-tier matching for invoice line items → POS products. Runs in order, stops at first match:

| Tier | Method | Confidence |
|------|--------|-----------|
| 1 | Exact UPC match | High |
| 2 | VendorProductMap lookup (previously confirmed) | High |
| 3 | SKU / item code match | Medium |
| 4 | Fuzzy string match on description | Medium |
| 5 | GPT-4o-mini AI match | Medium |
| 6 | Manual (user confirms in UI) | — |

### `marktPOSService.js`

- Fetches and caches bearer tokens in `PosToken` collection
- Automatic exponential backoff on rate limit / 429 responses
- Logs every API call to `PosLog` with endpoint, status, and timing
- `posScheduler.js` runs a background `setInterval` that proactively refreshes tokens before expiry

---

## 9. Feature Deep-Dives

### 9.1 Sales Analytics + Weather

**File:** `frontend/src/pages/SalesAnalytics.jsx`

**Tabs:** Daily · Weekly · Monthly · Yearly

**How it works:**
1. On mount, `checkLocation()` calls `GET /api/weather/store-location`. If `storeLatitude` is null, a yellow banner prompts the user to open the location modal.
2. Data fetched from `*-with-weather` endpoints — sales and weather are merged server-side by date key.
3. Charts use Recharts `ComposedChart` with dual Y-axes: left = `$` (sales), right = `°F` (temperature).
4. When data points exceed 90, the chart renders inside a scrollable wrapper with dynamic pixel width (`dataPoints × 18px`) to prevent cramping.

**Chart types** (selectable via `.chart-selector` buttons):
- **Master** — all metrics overlaid (sales area + temp lines + transaction bars)
- **Sales Trend** — net/gross sales area chart only
- **Weather** — temperature high/low + precipitation bars
- **Transactions** — transaction count bar chart

**Weekly expandable rows:** Clicking the chevron on a weekly row reveals a per-day sub-table showing individual day sales and weather. State is managed via a `Set` of expanded week keys.

**Location modal:** Supports manual lat/lng/timezone/address entry or browser geolocation (`navigator.geolocation.getCurrentPosition`). Saved via `PUT /api/weather/store-location`.

---

### 9.2 Live Dashboard

**File:** `frontend/src/pages/RealTimeDashboard.jsx`
**Route:** `/portal/realtime`
**Sidebar:** "Live Dashboard" with a Radio icon

- Auto-refreshes every **60 seconds** (countdown shown in header)
- `GET /api/sales/realtime` — returns the most recent day with non-zero sales (walks back up to 7 days if today has no IT Retail data yet). Returns `{ todaySales, isToday, dataDate, weather, ... }`
- `GET /api/weather/current` — current conditions + 3-day forecast
- `GET /api/sales/daily-with-weather` — last 14 days for the trend chart
- A **yellow banner** is shown when `isToday === false`, telling the user which date is being displayed

**IT Retail data delay:** IT Retail syncs data with a lag (sometimes a few hours). The `realtimeSales` endpoint handles this gracefully by falling back to the most recent available day rather than showing all dashes.

---

### 9.3 Sales Predictions + Residual Analysis

**File:** `frontend/src/pages/SalesPredictions.jsx`

The page has two tabs:

#### Forecast Tab

- `GET /api/sales/predictions/daily?days=14` or `/weekly?weeks=8`
- Trains Holt-Winters on the last 90 days, predicts the next N periods
- Applies day-of-week multipliers
- MAPE is calculated on the last 14 days (held out from training)
- US holidays are flagged from a hardcoded 2025–2026 lookup table

#### Model Accuracy Tab (Residual Analysis)

- `GET /api/sales/predictions/residuals?testDays=30`
- **Walk-forward validation**: trains on all data up to N−K days ago, predicts the last K days, compares vs actual
- Returns per-day `{ actual, predicted, residual, pctError }` + summary statistics

**Metrics displayed:**

| Metric | Meaning |
|--------|---------|
| **MAPE** | Mean Absolute Percentage Error — primary accuracy metric (target: <10%) |
| **MAE** | Mean Absolute Error in dollars — how far off on average |
| **RMSE** | Root Mean Squared Error — penalises large misses more than MAE |
| **Bias** | Average residual. Positive = model consistently under-forecasts. Negative = over-forecasts |

**Error distribution** shows the % of test days landing within ±5%, ±10%, ±15%, ±20% of actual.

**Residual bar chart:** Green bars = actual was higher than predicted (under-forecast). Red bars = actual was lower (over-forecast). A zero reference line is drawn.

#### Improving the Model Over Time

The current model is a solid baseline. The architecture is designed for the following improvements:

1. **Weather regression layer** — `WeatherCache` data is already stored per day. Add β coefficients for temperature deviation, rain flag, snow flag as correction factors on top of Holt-Winters output.
2. **Rolling retraining** — Retrain weekly on the most recent 90–180 days. Discard stale data so the model adapts to business changes faster.
3. **Holiday factors** — Use historical residuals around each holiday to learn actual uplift/drop multipliers rather than just flagging the date.
4. **Dynamic confidence intervals** — Replace hardcoded ±15% with `predicted ± (1.28 × RMSE)` for 80% confidence.
5. **LSTM neural net** — Viable once 2+ years of daily data is accumulated. Handles non-linear patterns and multiple input features natively.

---

### 9.4 Invoice OCR Pipeline

**Files:** `invoiceController.js`, `gptService.js`, `matchingService.js`, `InvoiceImport.jsx`

#### Processing flow

```
Upload PDF / image
       ↓
Azure Document Intelligence (prebuilt-invoice model)
  extracts text, tables, line items, header fields
       ↓
GPT-4o-mini enrichment
  fills gaps Azure missed, normalises product descriptions
       ↓
Tiered product matching  (6 tiers — see Section 8)
  tries UPC → VendorProductMap → SKU → fuzzy → AI → unmatched
       ↓
Draft saved to MongoDB  (status: 'draft')
  HTTP response returned immediately — processing continues async
       ↓
User reviews in ReviewPanel (full-screen overlay)
  ├── Invoice image viewer on left (PDF pages, zoom, scroll)
  ├── Invoice header fields top right (editable)
  ├── Common POS Vendor dropdown  ← applies to ALL line items at once
  └── Line items list  ← click any row to expand inline editor
           ├── Left column:  read-only invoice reference data
           └── Right column: POS editable fields
                   (description, UPC, pack, cert_code / vendor SKU,
                    case cost, unit cost [auto = caseCost ÷ pack],
                    retail price, department, deposit fees, taxes)
       ↓
User clicks "Confirm & Sync to POS"
  Step 1: POST /invoice/confirm  → MongoDB status: 'synced'
                                 → VendorProductMap updated (system learns)
  Step 2: Promise.allSettled bulk-push ALL matched items to IT Retail
          PUT /pos/products/:id/details  (one call per matched line item)
  Toast summary:  ✅ Invoice synced · 12 products updated in IT Retail · 2 unmatched skipped
```

#### Key UI behaviours

**Inline expand:** Clicking any line item row expands it in-place — no popup. All POS fields are editable directly in the row. Clicking again collapses it.

**Common POS Vendor bar** (purple, appears between Invoice Details and item list):
- Single dropdown sets `vendorId` on every line item simultaneously
- Shows `✓ All items set` (green) when unified, `⚠ Mixed` (amber) when items have different vendors
- Individual per-item vendor can still be changed manually in the expanded row if needed (vendor field is in the right column)

**Deposit fee hint:** If the invoice has a `depositAmount` on a line item, a green info bar shows:
`📄 From Invoice  Total deposit: $1.20  ÷ 24 pack  =  $0.0500 / unit`
This helps the user identify the matching fee card from the POS fees list without manual calculation.

**Fee cards:** When the POS fees API is available, clickable cards show each fee with its per-unit amount. Cards auto-highlight green when `abs(fee.amount − depositPerUnit) < $0.015` (close match). When the API is unavailable, falls back to a plain text field with a yellow **PENDING** badge.

**PriceInput (cash-register style):** All dollar-value fields (Case Cost, Retail Price, invoice header totals) use a custom `PriceInput` component instead of `<input type="number">`. The last 2 digits typed are always treated as cents:
- Type `5` → `0.05`
- Type `1599` → `15.99`
- `Backspace` removes last digit

**Scroll prevention:** All remaining `<input type="number">` fields (Pack/Units) have `onWheel={e => e.target.blur()}` to prevent accidental value changes when scrolling the page.

**Polling:** While any invoice has `status: 'processing'`, a `setInterval` polls `loadInvoices()` every 5 seconds and stops automatically when all invoices reach a terminal state.

**Dev mode guard:** All non-GET calls to MarktPOS return `{ success: true, testingMode: true }` in development. The toast message prefixes with `🔧 Dev mode:` so you know no real write happened.

**Required env vars:** `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`, `AZURE_DOCUMENT_INTELLIGENCE_KEY`, `OPENAI_API_KEY`

---

### 9.5 MarktPOS / IT Retail Integration

**Files:** `marktPOSService.js`, `posScheduler.js`, `salesService.js`

There are **two separate authentication contexts**:

| Context | Used for | Where stored |
|---------|----------|-------------|
| MarktPOS bearer token | Product sync, customer sync, price updates | `PosToken` collection |
| IT Retail OData session | Sales analytics data (daily/weekly/monthly/etc.) | Managed inside `salesService.js` |

The MarktPOS token is obtained when the user enters credentials in `/portal/pos-api`. `posScheduler.js` refreshes it automatically before expiry.

IT Retail OData uses `ITRETAIL_STORE_ID` and `ITRETAIL_TENANT_ID` from the `.env` file. These are fixed per store and don't change.

---

### 9.6 CSV Transformer

**Files:** `transformer.js`, `transformers/vendorRegistry.js`

The transformer is a vendor-agnostic dispatcher. Each vendor has its own module in `transformers/` that exports:
- `OUTPUT_COLUMNS` — array of output column names
- `transformRow(row, depositMap)` — maps one input row to one output row

Currently supported vendors: `AGNE`, `PINE_STATE_SPIRITS`

See [Section 14](#14-adding-a-new-csv-vendor) to add a new vendor.

---

## 10. Authentication & Authorization

**Token storage:** `localStorage` key `user` → `{ token, name, email, role }`

**Axios interceptor** in `frontend/src/services/api.js` automatically attaches the token to every request:
```js
config.headers.Authorization = `Bearer ${user.token}`;
```

**Backend middleware:**
```js
// Any authenticated user
router.get('/my-route', protect, myController);

// Admin only
router.post('/admin-only', protect, authorize('admin'), myController);

// Admin or store
router.get('/store-route', protect, authorize('admin', 'store'), myController);
```

**Offline fallback:** If MongoDB is unreachable, `auth.js` accepts the `LOCAL_ADMIN_EMAIL` / `LOCAL_ADMIN_PASSWORD` from `.env` and returns a valid JWT. Useful during development before MongoDB is set up, but some features (customer lookup, VendorProductMap, WeatherCache) won't work without a real database.

---

## 11. Styling System

All analytics pages share `frontend/src/pages/analytics.css`. Do **not** add per-page CSS files or use inline style objects for layout. Add new utility classes to `analytics.css`.

### Mobile responsiveness

The app is fully mobile-responsive. Layout breakpoints are defined in `index.css`:

| Breakpoint | Behaviour |
|---|---|
| `> 1024px` (desktop) | Full sidebar (210 px), normal padding |
| `≤ 1024px` (tablet) | `main-content` padding reduced to 1.5 rem |
| `≤ 768px` (mobile) | Sidebar hidden; hamburger button (top-left) slides it in as a drawer; `main-content` has no left margin, `padding-top: 60px` |

**Sidebar mobile classes:**
- `.mobile-menu-btn` — fixed hamburger button, `display: none` on desktop, `display: flex` on mobile
- `.sidebar-close-btn` — × button inside the drawer, hidden on desktop
- `.sidebar-overlay` — full-screen tap-to-close backdrop rendered when drawer is open
- `.sidebar.mobile-open` — toggled by React state; applies `transform: translateX(0)` to slide in

**ReviewPanel (Invoice Import) responsive classes** — CSS overrides with `!important` since the panel uses inline styles:
| Class | Mobile behaviour |
|---|---|
| `.review-topbar` | Wraps into two rows |
| `.review-topbar-actions` | Fills full width; buttons flex to equal size |
| `.review-body` | `flex-direction: column` |
| `.review-image-pane` | `display: none` (hidden on mobile to save space) |
| `.review-form-pane` | Reduced padding |
| `.review-item-grid` | 2-col → 1-col (invoice reference stacks above POS fields) |
| `.review-price-grid` | 3-col → 2-col (Case Cost, Unit Cost, Retail) |

**iOS zoom prevention:** On `≤ 768px`, all `input`, `select`, `textarea` are forced to `font-size: 16px !important`. iOS Safari zooms in when an input is focused if its font-size is under 16 px — this prevents that.

### CSS Variables (defined in `index.css`)

```css
--accent-primary        /* brand green: #7ac143 */
--accent-gradient       /* green gradient — used on page titles */
--bg-primary            /* main page background */
--bg-secondary          /* card backgrounds */
--bg-tertiary           /* input/row hover backgrounds */
--border-color          /* card and table borders */
--text-primary          /* headings and bold values */
--text-secondary        /* body text */
--text-muted            /* labels, placeholders, captions */
--radius-sm / --radius-md / --radius-lg / --radius-full
--shadow-sm / --shadow-md
--success               /* #10b981 green */
--warning               /* #f8c01d yellow */
--error                 /* #e30613 red */
```

### Key CSS Classes

| Class | Purpose |
|-------|---------|
| `.layout-container` | Root wrapper — `display: flex` for sidebar + main |
| `.main-content` | The `<main>` element (padding, scroll) |
| `.animate-fade-in` | Page load fade animation |
| `.analytics-header` | Title row — flex, space-between, wraps on mobile |
| `.analytics-title` | H1 with gradient text |
| `.analytics-subtitle` | Muted subtitle |
| `.analytics-controls` | Filter bar — flex row with labels, selects, buttons |
| `.analytics-stats-row` | Auto-fit KPI card grid |
| `.analytics-stat-card` | Individual KPI card |
| `.analytics-stat-icon` | Coloured icon box |
| `.analytics-stat-value` | Large number in KPI card |
| `.analytics-stat-label` | Small label in KPI card |
| `.analytics-chart-card` | White card wrapping a Recharts chart |
| `.analytics-chart-title` | Chart card header (flex with icon + text) |
| `.analytics-tab` | Tab button — add `.active` for selected state |
| `.analytics-table-wrap` | Horizontally scrollable table wrapper |
| `.analytics-table` | Styled `<table>` |
| `.analytics-loading` | Centered spinner + message |
| `.analytics-error` | Red error banner |
| `.filter-btn` | Small secondary action button |
| `.weather-setup-banner` | Yellow info banner |
| `.dp-*` | DatePicker component classes (calendar popup) |
| `.chart-scroll-wrapper` / `.chart-scroll-inner` | Scrollable chart for 90+ data points |
| `.weather-hero-card` | Current weather display (column layout) |
| `.forecast-strip` / `.forecast-day` | 3-day forecast row |
| `.pulse-dot` | Animated green live indicator dot |
| `.metric-toggles` / `.metric-toggle` | Chart series on/off toggle buttons |
| `.modal-overlay` / `.modal-card` | Full-screen modal backdrop + content |
| `.table-row-expandable` / `.table-sub-row` | Expandable weekly rows |

### Standard page template

```jsx
import Sidebar from '../components/Sidebar';
import './analytics.css';
import { SomeIcon } from 'lucide-react';

export default function MyPage() {
  return (
    <div className="layout-container">
      <Sidebar />
      <main className="main-content animate-fade-in">

        <div className="analytics-header">
          <div>
            <h1 className="analytics-title">Page Title</h1>
            <p className="analytics-subtitle">Description here</p>
          </div>
        </div>

        <div className="analytics-stats-row">
          <div className="analytics-stat-card">
            <div className="analytics-stat-icon"
              style={{ background: 'rgba(122,193,67,0.12)', color: '#7ac143' }}>
              <SomeIcon size={20} />
            </div>
            <div>
              <span className="analytics-stat-value">$1,234</span>
              <span className="analytics-stat-label">My Metric</span>
            </div>
          </div>
        </div>

        <div className="analytics-chart-card">
          <div className="analytics-chart-title">
            <SomeIcon size={16} style={{ color: '#7ac143' }} />
            Chart Title
          </div>
          {/* Recharts chart here */}
        </div>

      </main>
    </div>
  );
}
```

---

## 12. Adding a New Page

**Step 1 — Create the component**

`frontend/src/pages/MyNewPage.jsx` — use the template in Section 11.

**Step 2 — Register the route** in `frontend/src/App.jsx`:

```jsx
import MyNewPage from './pages/MyNewPage';

// Inside <Routes>:
<Route
  path="/portal/my-new-page"
  element={<ProtectedRoute><MyNewPage /></ProtectedRoute>}
/>
```

**Step 3 — Add sidebar link** in `frontend/src/components/Sidebar.jsx`:

The sidebar uses a `menuGroups` array with three categories: **Operations**, **Analytics**, **Integrations**. Add the new item to whichever group fits:

```js
import { SomeIcon } from 'lucide-react'; // add to existing import

// Inside menuGroups, in the appropriate group's `items` array:
{ name: 'My New Page', icon: <SomeIcon size={13} />, path: '/portal/my-new-page' },
```

> Use `size={13}` for all sidebar icons to keep them consistent.

---

## 13. Adding a New API Endpoint

**Step 1 — Write the handler** in the appropriate controller:

```js
// backend/src/controllers/myController.js
export const myHandler = async (req, res) => {
  try {
    const result = await someService(req.query);
    res.json({ data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
```

**Step 2 — Register the route:**

```js
// backend/src/routes/myRoutes.js
import { myHandler } from '../controllers/myController.js';
router.get('/my-endpoint', myHandler);
```

**Step 3 — Mount in server.js** (only if it's a brand new routes file):

```js
import myRoutes from './routes/myRoutes.js';
app.use('/api/my-resource', myRoutes);
```

**Step 4 — Add the frontend API call** in `frontend/src/services/api.js`:

```js
export const getMyData = (params) =>
  api.get('/my-resource/my-endpoint', { params }).then(r => r.data);
```

---

## 14. Adding a New CSV Vendor

**Step 1 — Create the transformer:**

```js
// backend/src/utils/transformers/my-vendor.js

export const OUTPUT_COLUMNS = ['Column1', 'Column2', 'Column3'];

export const transformRow = (row, depositMap) => {
  return {
    Column1: row['OriginalHeader1'] || '',
    Column2: row['OriginalHeader2'] || '',
    Column3: depositMap?.get(row['UPC']) || '0.00',
  };
};
```

**Step 2 — Register it** in `backend/src/utils/transformers/vendorRegistry.js`:

```js
import * as myVendor from './my-vendor.js';

const VENDORS = {
  AGNE: agneTransformer,
  PINE_STATE_SPIRITS: pineStateSpiritsTransformer,
  MY_VENDOR: myVendor,    // add this line
};
```

The new vendor automatically appears in the frontend vendor dropdown — no other changes needed.

---

## 15. Pending / Future Work

Pick these up in roughly this order:

### High Priority

- [ ] **Weather regression layer** — `WeatherCache` data is already stored per day alongside sales. The next step is to compute `β` coefficients for weather features (temp deviation from seasonal avg, `is_rain`, `is_snow`) that correct the Holt-Winters output. Start with a simple OLS regression fitted on the last 90 days of `(residual, weather_features)` pairs.

- [ ] **Rolling 90-day retraining** — Currently trains on a fixed 90-day window. Change to retrain weekly using a sliding window, so the model adapts faster to shifts in business pattern (new competition, store renovation, etc.).

- [ ] **Holiday adjustment factors** — The model flags holidays but applies no adjustment. Use historical residuals around each holiday date to estimate an actual uplift/drop multiplier (e.g., Thanksgiving ×2.1, Labor Day ×0.85). Store these in MongoDB so they update as more Thanksgivings accumulate.

- [ ] **Dynamic confidence intervals** — Replace hardcoded ±15% band in the forecast chart with `predicted ± (1.28 × RMSE)` for 80% confidence, where RMSE is the rolling RMSE from the residuals endpoint.

### Medium Priority

- [ ] **Dedicated Settings page** (`/portal/settings`) — Store location, timezone, notification preferences. Currently the location can only be set from a modal inside Sales Analytics.

- [ ] **eComm Integration** — `/portal/ecomm` is a placeholder. Planned: Shopify/WooCommerce product sync and online vs in-store revenue split in analytics.

- [ ] **Weather correlation for DepartmentAnalytics** — Currently weather is only merged in Sales Analytics and Live Dashboard. Adding it to department-level data would reveal which categories (beverages, ice cream, deli) are most weather-sensitive.

- [x] **Invoice cost-price sync back to POS** — ✅ Implemented. `Confirm & Sync to POS` now bulk-pushes all matched line items to IT Retail via `PUT /pos/products/:id/details` using `Promise.allSettled`.

- [ ] **Deposit/bottle fee API confirmation** — `GET /pos/taxes-fees` calls `FeesData/GetAllFees` on the MarktPOS API. The endpoint has not yet been confirmed as available by the POS provider. Once confirmed, the fee cards in the Invoice Review panel will auto-populate. Until then, the UI falls back to a manual text input with a yellow **PENDING** badge. Track this with the MarktPOS provider.

### Future / Long-term

- [ ] **LSTM neural network** — Once 2+ years of daily sales + weather data is in MongoDB, an LSTM (TensorFlow.js or a Python FastAPI microservice) will handle non-linear patterns and multi-feature inputs better than Holt-Winters.

- [ ] **Push notifications** — Alert the manager when today's sales are tracking more than 15% below prediction, or when a severe weather event is forecast for the next 3 days.

- [ ] **Multi-store support** — The `User` model has a single `storeLatitude/Longitude`. Extend to a `stores[]` array so a single account can manage multiple locations with per-store analytics.

- [ ] **Automated vendor recognition in invoice OCR** — Currently the vendor name comes from the OCR output. Add a classifier that identifies the vendor from layout/logo patterns and auto-routes to the correct matching ruleset.

---

## Common Gotchas

| Problem | Cause | Fix |
|---------|-------|-----|
| All API calls return 401 | CORS_ORIGIN port mismatch | Match `CORS_ORIGIN` in `.env` to whatever port Vite started on |
| 503 on signup/login | MongoDB Atlas paused | Resume cluster at cloud.mongodb.com, whitelist your IP |
| `Cast to ObjectId failed` on POS connect | Logged in via offline fallback (`offline-admin-*`) | Get MongoDB running and sign up with a real account |
| EADDRINUSE port 5000 | Previous backend process still running | `netstat -ano | findstr :5000` → find PID → `taskkill /PID <pid> /F` |
| Weather shows "—" everywhere | Store location not set | Sales Analytics → map-pin icon → enter lat/lng/timezone |
| Live Dashboard shows yesterday | IT Retail hasn't synced today yet | Normal — endpoint falls back to most recent day automatically |
| MarktPOS token expired after restart | posScheduler only runs while server is live | First request after cold start triggers a fresh token fetch automatically |
| Departments dropdown empty in Invoice Review | Wrong API endpoint used | Controller calls `DepartmentsData/GetAllDepartments` (note the **s**). Falls back to `/departments` if primary fails. Check `/api/pos/debug/reference-data` to inspect raw responses. |
| Fees cards not showing in Invoice Review | `FeesData/GetAllFees` not yet available from MarktPOS provider | Expected — the UI shows a manual text input with a PENDING badge instead. Confirm the endpoint with the POS provider and remove the fallback when available. |
| PriceInput shows wrong value after external update | Float precision rounding | The `PriceInput` component uses `Math.round(n * 100)` internally. Avoid storing prices with more than 2 decimal places in state — always pass `parseFloat(x).toFixed(2)` or the raw string from `PriceInput.onChange`. |

---

## 16. Changelog — April 2026

### Marketing Suite & Premium UI (1 April 2026)
- **New Marketing Website**: Launched a 5-page public site (`Home`, `Features`, `Pricing`, `About`, `Contact`) with a high-end glassmorphic aesthetic.
- **Glassmorphic Design System**: Unified the entire portal with a dark-mode, glass-effect UI including blurred backdrops, vibrant gradients, and premium typography (Outfit/Inter).
- **Lead Capture**: Integrated a validated demo request form on the contact page with simulated scheduling logic.
- **Enhanced Mobile Support**: Optimized marketing pages for mobile responsiveness with a custom slide-in navigation drawer.

### Legacy Transitions (March 2026)

All changes below were made in a single development session on 30 March 2026. Files changed are noted for each item.

---

### Root-level `npm run dev`

**File:** `CSV_Filter_Project/package.json` *(new file)*

Added a root-level `package.json` using `concurrently` so both servers can be started with a single `npm run dev` from the project root instead of requiring two separate terminals.

```bash
npm run dev          # starts both backend (:5000) and frontend (:5175)
npm run dev:backend  # backend only
npm run dev:frontend # frontend only
npm run install:all  # npm install for both packages
```

---

### Invoice Import — ReviewPanel UX overhaul

**File:** `frontend/src/pages/InvoiceImport.jsx`

#### Inline expansion (reverted from popup modal)
Line items expand **in-place** when clicked — a two-column inline editor opens inside the row (invoice reference on the left, POS editable fields on the right). No popup. Clicking the row again collapses it.

#### Common POS Vendor bar
A prominent purple/indigo bar appears between Invoice Details and the line items list. Selecting a vendor from the dropdown instantly sets `vendorId` on **every line item** at once. Status indicator shows:
- `✓ All items set` — all items have the same vendor
- `⚠ Mixed — select to override all` — items have different vendors

The per-item vendor dropdown has been removed from the individual line item expanded view (redundant now that the common vendor bar handles it).

#### Deposit / bottle fee calculation hint
When a line item has a `depositAmount` value from the invoice, a green info bar is shown inside the fee section:

```
📄 From Invoice   Total deposit: $1.20   ÷ 24 pack   = $0.0500 / unit
                  — select the fee closest to this value below
```
This eliminates the need to manually calculate which fee card matches.

#### `PriceInput` component — cash-register digit entry
**Replaces `<input type="number">` for all dollar-value fields.**

All price and amount fields (Case Cost, Retail Price, invoice header totals: Total, Tax, Discount, Deposit, Other Fees) use a new `PriceInput` component. It behaves like a POS cash-register entry:

| Keystrokes | Displayed value |
|---|---|
| `5` | `0.05` |
| `5`, `9` | `0.59` |
| `1`, `5`, `9`, `9` | `15.99` |
| Backspace | removes last digit |

Implemented with `onKeyDown` interception and a `useRef` for internal digit tracking. Syncs back from parent state changes (e.g., auto-calculated `unitCost`) without creating feedback loops.

Integer-only fields (Pack / Units per Case) keep `<input type="number">` but have `onWheel={e => e.target.blur()}` to prevent accidental scroll-changing.

#### Confirm & Sync — also pushes to IT Retail
Previously "Confirm & Sync" only saved the invoice to MongoDB. Now it runs a two-step process:

1. `POST /invoice/confirm` — marks invoice as `synced` in MongoDB, updates `VendorProductMap`
2. `Promise.allSettled` — bulk-calls `PUT /pos/products/:id/details` for every matched line item

Toast summary distinguishes: dev mode (simulated), partial failure, full success.

---

### POS Controller — new and updated endpoints

**File:** `backend/src/controllers/posController.js`
**File:** `backend/src/routes/posRoutes.js`

#### `fetchDepartments`
Fixed endpoint: `DepartmentsData/GetAllDepartments` (the Comcash/IT Retail API uses a plural `s` — using `DepartmentData` returned 404). Falls back to `/departments` if primary fails. Normalises field names across all known response shapes (`id/departmentId/Id/DepartmentId`, `name/departmentName/Name/DepartmentName`). Filters out records with `deleted: true`.

#### `getTaxesFees`  *(new)*
`GET /api/pos/taxes-fees` → `{ success, taxes: [{id, name, rate}], fees: [{id, name, amount, pack, feeType}] }`

Calls `TaxesData/GetAllTaxes` and `FeesData/GetAllFees` in parallel. The `pack` field on fees is extracted to support deposit fee matching by pack size (e.g., $0.30 per 6-pack, $1.20 per 24-pack). If `FeesData/GetAllFees` is not yet available from the POS provider, the fees array returns empty and the UI shows a manual fallback input.

#### `updatePOSProductDetails`  *(new)*
`PUT /api/pos/products/:id/details` — updates pack size, case cost, unit cost, retail price, department, vendor, vendor SKU (`cert_code`), deposit fees, and taxes for a product in IT Retail.

#### `createPOSProduct`  *(new)*
`POST /api/pos/products/create` — creates a brand-new product in IT Retail from invoice data.

#### `debugReferenceData`  *(new, dev only)*
`GET /api/pos/debug/reference-data` — hits `DepartmentsData/GetAllDepartments`, `VendorsData/GetAllVendors`, `TaxesData/GetAllTaxes`, `FeesData/GetAllFees` simultaneously and returns all four raw responses. Use this to inspect the exact field shapes when debugging why dropdowns aren't populating.

---

### Sidebar — grouped navigation

**Files:** `frontend/src/components/Sidebar.jsx`, `frontend/src/index.css`

#### Grouped menu structure
Items reorganised into three labelled sections:

| **Operations** | **Analytics** | **Integrations** |
|---|---|---|
| Live Dashboard | Sales | Vendor Orders |
| Customers | Departments | POS API |
| Invoice Import | Products | eComm |
| CSV Transformer | Predictions | |

Logout sits at the bottom of the sidebar with a divider line above it.

#### Visual tightening
- Sidebar width: `260px` → `210px`
- Nav link padding: `0.875rem 1rem` → `0.45rem 0.6rem`
- Nav link gap: `0.5rem` → `0.1rem`
- Font size: `~0.9rem` → `0.8rem`
- Active indicator: left border 2 px (was 3 px), same green colour
- Icon opacity: `0.75` at rest, `1` on hover/active
- Group labels: `0.6rem` uppercase muted headers

---

### Mobile responsiveness

**Files:** `frontend/src/index.css`, `frontend/src/components/Sidebar.jsx`, `frontend/src/pages/InvoiceImport.jsx`, `frontend/src/App.css`

#### Sidebar — slide-in drawer
On mobile (`≤ 768px`), the sidebar is hidden off-screen (`transform: translateX(-220px)`) rather than collapsed to `width: 0`. A fixed hamburger button (top-left) slides it in. Tapping the overlay or any nav link closes it automatically.

The `Sidebar` component:
- Manages `mobileOpen` state internally
- Uses `useEffect` on `location.pathname` to close when the route changes
- Locks body scroll while the drawer is open

#### Invoice ReviewPanel
| Element | Desktop | Mobile |
|---|---|---|
| Invoice image pane | Shown (left 50%) | **Hidden** — saves screen for the form |
| Top bar | Single row | Wraps; action buttons fill full width |
| Line-item expanded grid | 2-col (reference \| POS fields) | 1-col (stacked) |
| Price row | 3-col (Case Cost / Unit Cost / Retail) | 2-col |

#### iOS zoom fix
All inputs forced to `font-size: 16px` on mobile — iOS Safari zooms in on focus if font-size < 16 px.

#### `App.css` fix
Removed `max-width: 1280px; margin: 0 auto; padding: 2rem` from `#root` — this was constraining the full-width layout and breaking the fixed sidebar on narrow screens.
