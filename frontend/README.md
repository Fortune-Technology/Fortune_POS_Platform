# Storeveu POS — Portal Frontend

A premium, dark-themed management portal for Storeveu POS store owners and managers. Built with **React 19**, **Vite 7**, and **Redux Toolkit**.

---

## ✨ Design Philosophy

- **Light Theme:** Clean white/slate surfaces with brand blue accents (`--brand-primary: #3d56b5`).
- **Consistent Layout:** Shared `Layout.jsx` wraps all portal routes — Sidebar mounts once and persists across navigation (React Router `Outlet`).
- **External CSS Only:** Every component has a dedicated `.css` file with a unique class-name prefix. Zero inline `style={{}}` in new code. See `ENGINEERING_PRINCIPLES.md`.
- **Dynamic Interactions:** Subtle hover micro-animations and smooth transitions.
- **Responsive:** Breakpoints at 1024/768/480px across all pages. Hamburger nav below 768px.

---

## ⚡ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Core** | React 19, Javascript (ESM) |
| **Build Tool** | Vite 7 |
| **State Management** | Redux Toolkit (RTK Query) |
| **Routing** | React Router v6 |
| **Charts** | Recharts (Dual-axis charts) |
| **Icons** | Lucide React |
| **Styling** | Vanilla CSS (Glassmorphism design system) |

---

## Folder Structure

```
frontend/
├── public/                → Static assets (favicon, manifest, sounds/ordernotification.mp3)
├── src/
│   ├── assets/            → Logos and imagery
│   ├── components/        → Shared UI (Sidebar, Layout, Navbar, StoreSwitcher, InactivityLock,
│   │                         PermissionRoute, TransferOwnershipModal, UserRolesModal,
│   │                         BarcodeScannerModal, EcomOrderNotifier, PriceInput, SEO, ...)
│   ├── contexts/          → React contexts (StoreContext)
│   ├── hooks/             → usePermissions, useNotificationCounts (when present)
│   ├── rbac/              → routePermissions.js — single source of truth for route → permission key
│   ├── pages/             → 60+ module views including marketing/, Lottery, Fuel,
│   │                         QuickButtonBuilder, MyProfile, MyPIN, Invitations,
│   │                         AcceptInvitation, Roles, ResetPassword, Unauthorized, ...
│   ├── services/          → api.js (Axios instance with 401 interceptor + X-Store-Id header)
│   ├── store/             → Redux slices
│   ├── styles/            → portal.css (shared `p-*` classes)
│   ├── utils/             → formatters.js, exportUtils.js (CSV/PDF download)
│   ├── App.jsx            → All routes wrapped in `<PermissionRoute>` under shared `<Layout>`
│   └── main.jsx           → Entry point
├── index.html             → Base HTML template (--content-max-width, --mkt-max-width tokens)
└── package.json
```

---

## 🚀 Key Modules

### 1. Real-Time Dashboard
A live status board that auto-refreshes every 60 seconds with current sales data, weather conditions, and trend analysis.

### 2. POS Product Catalog
The master management interface for the native PostgreSQL product database. Allows managers to edit pricing, inventory, and compliance flags (EBT, Age Check).

### 3. Invoice OCR Import
A side-by-side review panel that uses Azure Intelligence and GPT-4o-mini to extract line items from PDFs and match them to the POS catalog.

### 4. Sales Predictions
Uses Holt-Winters Triple Exponential Smoothing to forecast future sales based on historical trends, seasonal patterns, and day-of-week factors.

### 5. Lottery & Compliance
A high-integrity management system for scratch-ticket inventory, box activation, and automated EOD reconciliation (8 tabs: Overview, Games, Inventory, Active Tickets, Shift Reports, Reports, Commission, Settings).

### 5b. Fuel Module
Full gas-station fuel sale + refund system (Session 23). Portal page has 4 tabs: Overview, Fuel Types (3-decimal $/gallon), Sales Report, Settings. Cashier app gets Fuel Sale + Fuel Refund buttons in the action bar when the store has fuel enabled.

### 6. Public Marketing Site
A high-performance promotional site with landing pages and product feature deep-dives, optimized for SEO (Home, About, Features, Pricing, Contact).

### 7. Employee Reports
Comprehensive sales performance analytics per staff member, linked to the native POS transaction logs.

### 8. Receipt Settings
Per-store receipt configuration: print behaviour, paper width, store info, custom header/footer lines, return policy, branding sync.

### 9. Store & Station Management
Multi-store CRUD with branding, location/geo-mapping, and per-station hardware configuration (printers, scales, PAX terminals).

### 10. Bulk Import
CSV/Excel product import pipeline with preview, validation, column mapping, and batch commit.

### 11. Fee & Deposit Management
Service fee mapping (bottle deposit, bag fee, alcohol surcharge) and cross-store deposit rules.

### 12. Shared Layout & Persistent Sidebar
All portal routes are nested under a shared `Layout.jsx` wrapper that renders the `Sidebar` once and uses React Router's `Outlet` for page content. The sidebar persists across all navigation and scrolls independently from the main content area. The sidebar also renders a clickable "signed in as" user card (→ `/portal/my-profile`).

### 13. RBAC-Gated Navigation
Every portal route is wrapped in `<PermissionRoute>` which reads `localStorage.user.permissions` (populated at login) and renders `<Unauthorized />` on missing perms. The Sidebar filters its nav items through the same `routePermissions.js` map — users only see links they can access. The `usePermissions()` hook + `<Can permission="...">` component are available for per-button gating. Superadmin always bypasses.

### 14. Quick Buttons WYSIWYG Builder
Drag-and-drop tile builder for the cashier POS home screen (`/portal/quick-buttons`, Sessions 37 + 37b). Tiles support product, folder (1-level), action (19 whitelisted POS handlers), text, and image types. Uses `react-grid-layout` (legacy adapter) with configurable row height (40–160px) and grid columns (3–12). Image uploads land in `/uploads/quick-buttons/`.

### 15. Multi-Org Access
A single email/login can have `UserOrg` memberships in many organisations. StoreSwitcher groups stores by org name when multiple memberships exist. `req.orgId` on the backend is derived from the active store, so switching stores switches the active org. Store transfer is a first-class flow — see `TransferOwnershipModal` and `/portal/invitations`.

### 16. Self-Service User Pages
- `/portal/my-profile` — any authenticated user can edit name/phone, change password (live strength meter)
- `/portal/account?tab=mypin` — per-store register PIN management (`UserStore.posPin`)
- `/portal/invitations` — manager+ can invite teammates (7-day tokens, email + optional SMS)

### 17. Inactivity Lock
`InactivityLock.jsx` mounts globally; after 60s idle on any `/portal/*` route it overlays a password re-verify screen (`POST /auth/verify-password`). Session + current page preserved — only interaction blocked.

### 18. SEO Component
`components/SEO.jsx` provides consistent meta tag management (title, description, Open Graph) across all marketing and portal pages.

### 19. Shared Formatters + Export
`utils/formatters.js` (currency/date/percentage) and `utils/exportUtils.js` (CSV + jspdf PDF downloads) are reused across every analytics and report page.

---

## 🛠️ Getting Started

```bash
cd frontend
npm install
npm run dev
```
Runs the dev server on `http://localhost:5173`.
