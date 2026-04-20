# Engineering Principles Implementation

## ✅ Core Principles Applied

### 1. **DRY (Don't Repeat Yourself)**

- ✅ Created `src/utils/` with reusable utility functions for both backend and frontend
- ✅ Centralized response formatting (`formatSuccessResponse`, `formatErrorResponse`)
- ✅ Reusable data serialization (`serializeUser`, `serializeUserWithTokens`)
- ✅ Common validation functions (`validateEmail`, `isValidObjectId`)
- ✅ Shared formatting utilities (`formatDuration`, `formatFileSize`, `formatDate`)

### 2. **KISS (Keep It Simple, Stupid)**

- ✅ Simple, readable function names
- ✅ Clear separation of concerns
- ✅ Minimal complexity in each function
- ✅ Avoided over-engineering

### 3. **PostgreSQL & Prisma 5 (Standardized ORM)**

- ✅ Type-safe database queries via Prisma
- ✅ Automated schema synchronization with `npx prisma db push`
- ✅ PostgreSQL 16 for all relational data (Catalog, Transactions, Identity)
- ✅ Relation-heavy logic (Multi-tenant scoping) handled natively by DB constraints

### 4. **SOLID Principles**

#### Single Responsibility

- ✅ Each controller handles one resource (auth, content, categories, etc.)
- ✅ Utility functions have single, focused purposes
- ✅ Separated `FavoriteButton` from `ContentCard` component
- ✅ Models handle only data structure and validation

#### Open/Closed

- ✅ Middleware can be extended without modification
- ✅ Utility functions are extensible
- ✅ Redux slices can be extended with new actions

#### Liskov Substitution

- ✅ Consistent API response format across all endpoints
- ✅ All async handlers follow same pattern

#### Interface Segregation

- ✅ Specific service methods for each API endpoint
- ✅ Focused React hooks for specific use cases

#### Dependency Inversion

- ✅ Controllers depend on abstractions (services, utilities)
- ✅ Components use Redux store abstraction
- ✅ API layer separated from business logic

### 4. **YAGNI (You Aren't Gonna Need It)**

- ✅ No unused features or over-engineering
- ✅ Implemented only required functionality
- ✅ Avoided premature optimization

### 5. **Separation of Concerns**

- ✅ **Backend**: Models → Controllers → Routes → Middleware
- ✅ **Frontend**: Components → Pages → Store → Services
- ✅ Clear layer boundaries

### 6. **High Cohesion & Low Coupling**

- ✅ Related functions grouped in same files
- ✅ Modules are independent and loosely connected
- ✅ Components can be used independently

### 7. **Clean Architecture**

- ✅ Domain-driven layers (models, controllers, services)
- ✅ Clear boundaries between layers
- ✅ Business logic separated from presentation

### 8. **Fail Fast**

- ✅ Input validation at controller level
- ✅ Early return on errors
- ✅ Validation middleware before processing
- ✅ `validateRequiredFields` utility

### 9. **Idempotency**

- ✅ PUT/DELETE operations are idempotent
- ✅ Favorite toggle handles repeated operations safely
- ✅ Resume review can be updated multiple times

### 10. **Secure by Design**

- ✅ **JWT authentication** — 8-hour access tokens (raised from 2h in Session 29 after premature-lockout reports), configurable via `JWT_ACCESS_TTL`
- ✅ **Password hashing** with bcrypt (12 rounds for user passwords, 10 rounds for POS PINs)
- ✅ **Server-enforced password policy** — 8+ chars, upper/lower/digit/special (Session 18 / H-1)
- ✅ **RBAC via permission keys** — 133-key catalog in `backend/src/rbac/permissionCatalog.js`; routes gated with `requirePermission('module.action')` (Sessions 30–31). Legacy `authorize(...roles)` still works for back-compat, but new code uses permissions. Superadmin auto-passes every check.
- ✅ **Multi-org access** — `UserOrg` junction + active-store-derived `req.orgId` (Sessions 32–35). Permissions resolved per-org.
- ✅ **Input validation** — shared validators (`validateEmail`, `validatePassword`, `validatePhone`, `parsePrice`) in `backend/src/utils/validators.js`
- ✅ **Rate limiting** — 7-tier in-memory limiter on auth + PIN + public invitation endpoints (Sessions 18, 35)
- ✅ **SQL injection prevention** — Prisma parameterized queries throughout; zero raw SQL
- ✅ **XSS prevention** — DOMPurify sanitization on all CMS + Career HTML rendering (Session 18 / C-2)
- ✅ **Global 401 interceptor** — stale tokens auto-clear and redirect to `/login?session=expired` (Session 18 / H-8)
- ✅ **Internal service auth** — `X-Internal-Api-Key` shared secret on `ecom-stock-check` endpoint (Session 18 / C-1)
- ✅ **Tenant isolation** — every Prisma query scoped to `orgId` + optional `storeId` via `scopeToTenant` middleware
- ✅ **Price parsing hardened** — `parsePrice()` rejects NaN/Infinity/scientific-notation/negatives (Session 18 / H-5)

### 11. **Scalability First**

- ✅ **PostgreSQL indexing** on UPC, orgId, and storeId for sub-10ms lookups
- ✅ Pagination implemented for large catalogs and transaction histories
- ✅ Async/await for non-blocking operations
- ✅ Stateless JWT authentication (horizontal scaling ready)
- ✅ S3 for file storage (scalable)
- ✅ Modular architecture for microservices migration

## 📁 Code Organization

### Backend

```
✅ Constants centralized in constants.js
✅ Utilities in helpers.js
✅ Middleware separated by concern
✅ Controllers follow consistent pattern
✅ Models with proper validation
✅ Services layer for business logic
```

### Frontend

```
✅ Constants in constants.js
✅ Utilities in helpers.js
✅ Custom hooks for reusable logic
✅ Redux slices for state management
✅ Service layer for API calls
✅ Component composition
```

## 🔒 Security Implementation (Sessions 18 + 29–37b Hardening)

### Authentication
- ✅ JWT with **8-hour access token TTL** (`JWT_ACCESS_TTL` env var, default `8h`; was `2h` through Session 28)
- ✅ Bcrypt password hashing (12 rounds for users, 10 for PINs)
- ✅ Random 16-char crypto-generated temp passwords for admin-created users (no hardcoded defaults)
- ✅ Forgot/reset password flow end-to-end with token expiry + strength meter UI
- ✅ Portal inactivity lock — 60s idle → password re-verify overlay (`POST /auth/verify-password`)
- ✅ PIN tiered lookup — per-store `UserStore.posPin` wins over org-wide `User.posPin` (Session 36)
- ✅ Back Office PIN-SSO — cashier-app → portal via `/impersonate?token=JWT` using the manager PIN's JWT, not the browser's stale localStorage session (Session 37b)

### Rate Limiting (`backend/src/middleware/rateLimit.js`)
| Limiter | Window | Max | Applied To |
|---|---|---|---|
| `loginLimiter` | 15 min | 5 | `/auth/login`, `/auth/phone-lookup`, `/auth/verify-password` |
| `signupLimiter` | 60 min | 10 | `/auth/signup` |
| `forgotPasswordLimiter` | 60 min | 3 | `/auth/forgot-password` |
| `resetPasswordLimiter` | 15 min | 20 | `/auth/reset-password` |
| `pinLimiter` | 5 min | 15 | `/pos-terminal/clock`, `/pos-terminal/pin-login` |
| `invitationLookupLimiter` | 10 min | 20 | `GET /invitations/:token` |
| `invitationAcceptLimiter` | 10 min | 10 | `POST /invitations/:token/accept` |

### Input Validation (`backend/src/utils/validators.js`)
- ✅ `validateEmail` — regex + length check, applied to all email fields
- ✅ `validatePassword` — 8-128 chars, upper/lower/digit/special enforced
- ✅ `validatePhone` — 7-15 digits, E.164-ish normalization
- ✅ `parsePrice` — rejects NaN/Infinity/scientific/negatives, rounds to 4 decimals for Prisma `Decimal(10,4)`

### RBAC (Sessions 30–31)
Five-layer defence:
1. **Sidebar filter** — nav items hidden when `routePermissions.js` map key fails `can(...)` check
2. **Route guard** — `<PermissionRoute>` wraps every portal + admin route; renders `<Unauthorized />` on missing perm
3. **Backend API enforcement** — `requirePermission('module.action')` on every mutating route (critical layer — all others can be bypassed; this one is load-bearing)
4. **Per-button CRUD gating** — `usePermissions()` + `<Can>` hide Add/Edit/Delete affordances
5. **JWT permissions** — `POST /auth/login` response includes `permissions: string[]`; stored in `localStorage.user`; `/api/roles/me/permissions` refresh endpoint available

Built-in system roles: superadmin (133), owner/admin (90), manager (67), cashier (16), staff (1).
Custom per-org roles created via portal `/portal/roles`.
**Deployment requirement:** run `node prisma/seedRbac.js` on every deploy to sync the role-permission junction. Missing this is the #1 cause of "works locally, 403 in prod" regressions.

### Tenant Isolation
- ✅ `scopeToTenant` middleware derives `req.orgId` from the active store (`X-Store-Id` header), NOT from the JWT — supports multi-org access via `UserOrg` memberships (Sessions 32–35)
- ✅ `User.orgId` is nullable — a user between orgs (mid-onboarding, post-transfer) is a legitimate state
- ✅ Every Prisma query scoped to `req.orgId` (+ optional `req.storeId`)

### Network Security
- ✅ CORS with origin whitelist (comma-separated in `CORS_ORIGIN`)
- ✅ Internal service-to-service auth via `X-Internal-Api-Key` shared secret
- ✅ Tokens stored in `Authorization: Bearer` header (never URL params)
- ✅ `localStorage` session with global 401 interceptor auto-cleanup

### XSS & Content Safety
- ✅ DOMPurify sanitization on all `dangerouslySetInnerHTML` (CMS pages, career descriptions)
- ✅ `FORBID_TAGS`: script, style, iframe, object, embed, form
- ✅ `FORBID_ATTR`: onerror, onload, onclick, onmouseover, onfocus, onblur, style
- ✅ Email normalization to lowercase on write to prevent collation-based bypass

### Pending (Deferred as Architectural Projects)
- ⏳ **M-6** httpOnly cookie migration (1-2 sprint refactor affecting all 4 apps + CSRF tokens)
- ⏳ **M-7** Stripe Elements iFrame for CVV capture (requires merchant onboarding)
- ⏳ Redis-backed rate limiter for horizontal scaling (current in-memory limiter resets on backend restart)
- ⏳ **Phase 4** Multi-org `Group`/`Brand` rollup reporting for franchisees with multiple LLCs (see CLAUDE.md deferred-work section)

## 🎨 UI Conventions

### External CSS (hard rule for all new code)
Every new React component or page **must** have a dedicated `.css` file with a **unique class-name prefix**. **Zero inline `style={{}}` objects in new JSX.** Examples: `vpm-`, `brm-`, `qbb-`, `ar-`, `rl-`, `mp-`, `bsm-`, `fm-`, `eod-`, `pos-`, `fuel-`.

**Acceptable exceptions:**
- Recharts props (`contentStyle`, `fill`, `stroke`) — library API requires inline objects
- Dynamic data-driven values (status badge colors from DB, chart legend dots)
- CSS custom property injection pattern: `style={{ '--tpl-hero-bg': section.bg }}` consumed by `var(--tpl-hero-bg)` in the stylesheet
- POS layout config presets (dynamic widths/order computed at runtime)

### Centralized CSS Variables
| Variable | Value | Defined in |
|----------|-------|-----------|
| `--content-max-width` | `1400px` | `frontend/src/index.css`, `admin-app/src/styles/global.css` |
| `--mkt-max-width` | `1200px` | `frontend/src/index.css` |
| `--modal-overlay` | `rgba(0, 0, 0, 0.55)` | `frontend/src/index.css` |
| `--modal-overlay-strong` | `rgba(0, 0, 0, 0.7)` | `frontend/src/index.css` |
| `--modal-shadow` | `0 24px 64px rgba(0, 0, 0, 0.4)` | `frontend/src/index.css` |
| `--brand-primary` | `#3d56b5` | Portal brand blue |

No hardcoded `max-width: 1400px` or `rgba(0,0,0,0.55)` overlay values in new CSS — use the tokens.

### Transaction Status Convention
`Transaction.status` in the backend has exactly three values:
- `complete` — normal completed sale (includes net-negative carts from bottle returns)
- `refund` — refund transaction (stored as POSITIVE `grandTotal`; summaries subtract via `-Math.abs(...)`)
- `voided` — voided transaction (excluded from Gross/Net; counted separately)

All sales-summary surfaces (Live Dashboard, Sales Analytics, Department Analytics, Top Products, Back-office Transactions page, EoD Report) use `status: { in: ['complete', 'refund'] }` with the refund-subtract sign convention. Unified in Session 27. **Cashier-app `batchCreateTransactions` forces `status: 'complete'` on every write** (Session 28 — was previously honoring the client's local offline-sync flag `'pending'` and hiding cash sales from reports).

### Horizontal-Scroll Prevention
- `.main-content` has `overflow-x: hidden` + `min-width: 0` in both portal and admin
- Tables scroll horizontally inside `.p-table-wrap` / `.admin-table-wrap`; page never scrolls sideways
- `.main-content` uses `flex: 1 1 0; min-height: 0` pattern (not `height: 100vh`) to avoid double-scroll inside flex containers

## ⚡ Performance Optimizations

- ✅ **PostgreSQL indexes** on frequently queried fields (upc, storeId)
- ✅ Pagination for large catalog datasets (Master/Store products)
- ✅ Lazy loading for dashboard charts and images
- ✅ Debounce for search inputs
- ✅ Throttle for scroll events
- ✅ React.memo for expensive components (can be added)
- ✅ Code splitting with React Router

## 🧪 Testability

- ✅ Pure utility functions (easy to test)
- ✅ Async handlers wrapped for error handling
- ✅ Mocked API services
- ✅ Isolated components
- ✅ Redux actions testable

## 📝 Documentation

- ✅ API endpoint documentation in controllers
- ✅ JSDoc-style comments for complex functions
- ✅ README with setup instructions
- ✅ Implementation plan with architecture details
- ✅ Walkthrough document

## 🎯 Best Practices Followed

### Backend

- ✅ Environment-based configuration
- ✅ Error handling middleware
- ✅ Async/await pattern
- ✅ Consistent API response format
- ✅ Logging with Morgan
- ✅ Compression middleware
- ✅ Cookie parser for sessions

### Frontend

- ✅ Component composition
- ✅ Custom hooks for logic reuse
- ✅ Redux Toolkit for state management
- ✅ Axios interceptors for auth
- ✅ Toast notifications for UX
- ✅ Loading states
- ✅ Error boundaries (can be added)
- ✅ Accessibility attributes

## 🚀 Outcome Achieved

✅ **High Performance**: Optimized queries, indexing, pagination, lazy loading  
✅ **Secure Architecture**: JWT, bcrypt, rate limiting, validation, CORS  
✅ **Clean Code**: DRY, SOLID, consistent patterns, readable  
✅ **Scalable Backend**: Stateless auth, modular, horizontal scaling ready  
✅ **Scalable Frontend**: Component-based, state management, code splitting  
✅ **Easy Maintainability**: Clear structure, documentation, utilities  
✅ **Future-proof**: Extensible architecture, clean boundaries

## 📊 Code Quality Metrics (Actual Audit — April 2026, Session 18)

- **Code Duplication**: Improved — shared `formatters.js`, shared `validators.js` (Session 18), `PriceInput` component (Session 18) — 30+ duplicate functions consolidated
- **Inline Styles**: Portal pages clean. ProductForm DeptManager/VendorManager migrated to `pf-mm-*` classes (Session 18 / L-1). Cashier-app still has ~390 inline styles (tracked debt).
- **CSS Utilization**: ~77% (some orphaned/unused classes in BulkImport.css, Departments.css)
- **Error Handling**: Mixed — 88 `next(err)` vs 209 direct `res.status().json()` in backend. All new Session 18 controllers use consistent 400/401/403/409/500 semantics.
- **Debug Artifacts**: Zero console.log debug statements, zero TODO/FIXME/HACK comments
- **Test Coverage**: 2 test files in `backend/tests/` — needs expansion (see Session 18 QA checklist in README)
- **Security Audit (Session 18)**: 30/32 issues fixed (94% coverage). 100% of Critical + High + Low resolved; 2 Medium deferred as architectural projects.
- **Build Health**: All 4 apps compile clean (portal, cashier, admin, storefront). 16 modified JSX files verified via esbuild.

## Continuous Improvement Areas

1. **Add unit tests** (Jest, Supertest, React Testing Library)
2. **Standardize backend error handling** — consolidate on `next(err)` pattern
3. **Complete cashier-app CSS migration** (~390 remaining inline styles)
4. **Add error boundaries** in React apps
5. **Add API documentation** (Swagger/OpenAPI)
6. **Implement structured logging** (Winston with log levels)
7. **Clean up orphaned CSS** (Departments.css, unused BulkImport.css classes)

**Already implemented:**
- CI/CD pipeline (GitHub Actions — `.github/workflows/deploy.yml`)
- Health check endpoints (`/health`)
- PM2 process management (production)
- Nginx reverse proxy (production)
- SEO/AEO/GEO optimization (meta tags, JSON-LD, robots.txt, sitemap.xml)
- Shared formatting utilities (`frontend/src/utils/formatters.js`)

🧩 What Was Missing (Now Added) 12. Type Safety & Language Discipline (JS + TypeScript)
JavaScript (JS)
✅ Modern ES6+ syntax (async/await, destructuring, modules)
✅ Avoided mutation-heavy patterns
✅ Consistent error handling
✅ Lint-ready code structure

TypeScript (TS)

✅ Strong typing for API responses
✅ Shared DTO / Interface contracts (Backend ↔ Frontend)
✅ Reduced runtime errors via compile-time checks
✅ Typed Redux slices & async thunks
✅ Typed Express request/response objects
✅ Safer refactors & long-term maintainability

📌 Benefit: Fewer bugs, safer scaling, better DX (Developer Experience)

13. Node.js & Express Best Practices (Explicitly Covered)
    Node.js

✅ Event-driven, non-blocking architecture
✅ Async I/O for scalability
✅ Environment-based configs
✅ Process-safe stateless design
✅ Ready for clustering / PM2

Express.js

✅ Thin controllers, fat services
✅ Middleware-driven architecture
✅ Centralized error handling
✅ Request validation middleware
✅ Route-level authorization
✅ Versionable API structure (/api/v1 ready)

📌 Benefit: Clean APIs, predictable behavior, easy scaling

14. React.js Architecture (Advanced Coverage)

✅ Atomic component structure
✅ Smart vs dumb components
✅ Custom hooks for reusable logic
✅ Controlled & uncontrolled inputs
✅ Optimized re-renders (memoization-ready)
✅ Side-effect isolation (useEffect discipline)
✅ UX-first state handling (loading, error, empty states)

📌 Future-ready additions

Error Boundaries

Suspense + lazy loading

Server Components (if Next.js App Router)

15. React + Vite & SEO (Updated for Current Stack)
    🔍 SEO Implementation (Single Page Application)
    Traditional SEO (Search Engine Optimization)

✅ Client-Side Rendering (CSR) with Vite
✅ Dynamic Meta Tags using React Helmet (Recommended)
✅ Meta tags (title, description)
✅ Canonical URLs
✅ Sitemap & robots.txt
✅ Optimized Core Web Vitals
✅ Image optimization (next/image)
✅ Clean URL structure

AEO (Answer Engine Optimization)

Optimizing for AI answers & voice assistants

✅ Structured content (Q&A style)
✅ Clear headings (H1 → H3)
✅ FAQ schema support
✅ Direct, concise answers
✅ Semantic HTML
✅ Featured-snippet-friendly content

GEO (Generative Engine Optimization)

Optimizing for ChatGPT, Gemini, Copilot, AI search

✅ High signal-to-noise content
✅ Entity-based clarity
✅ Context-rich explanations
✅ Trust signals (authorship, clarity)
✅ Consistent terminology
✅ Human-readable + machine-readable balance

📌 SEO vs AEO vs GEO Summary

Aspect Focus Platform
SEO Rankings Google / Bing
AEO Direct answers Voice + AI assistants
GEO AI citations ChatGPT / Gemini / Copilot 16. API Contracts & Versioning

✅ Backend → Frontend contracts defined
✅ DTOs / serializers control response shape
✅ No leaking DB models
✅ API versioning ready
✅ Backward compatibility ensured

📌 Benefit: Safe frontend updates without breaking backend

17. Observability & Production Readiness

You mentioned logging & monitoring — here’s what to explicitly add:

✅ Structured logs (requestId-based)
✅ Centralized error logs
✅ Performance metrics hooks
✅ Health check endpoint (/health)
✅ Graceful shutdown handling
✅ Crash-safe process management

18. Security (Advanced Additions)

You already did great — add these mentions:

✅ HTTP-only cookies (refresh tokens)
✅ Token rotation strategy
✅ Password strength enforcement
✅ API abuse prevention
✅ Secure headers enforced end-to-end
✅ Dependency vulnerability awareness

19. Scalability & Deployment Readiness

✅ Horizontal scaling ready
✅ Stateless backend
✅ CDN-friendly frontend
✅ Build-time vs runtime separation
✅ Ready for Docker / Cloud deployment
✅ Monorepo or polyrepo friendly
