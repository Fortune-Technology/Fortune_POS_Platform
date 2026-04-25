# @storeveu/types

Shared TypeScript types for the Storeveu POS platform.

## What lives here

Hand-maintained type definitions for **API response shapes** consumed across:

- `storefront/` — public ecom storefront (Next.js)
- `admin-app/` — superadmin panel (Vite + React)
- `frontend/` — portal (Vite + React) — *not yet consuming, Phase 5*
- `cashier-app/` — POS register (Vite + React + Electron) — *not yet consuming, Phase 6*
- `backend/`, `ecom-backend/` — REST APIs that produce these shapes — *not yet consuming, Phase 4*

These are **NOT** auto-generated from Prisma. They are curated to expose only the
fields that consumers actually touch, with sensible widening for fields that
are sometimes-present (e.g. relation includes).

## Why hand-maintained, not Prisma-derived

The pragmatic Phase 3 trade-off: Prisma's generated types include every column
on every model, which leaks internal-only fields into the frontend type
surface and explodes the surface area you'd review when reading a component.
Hand-maintained types narrow each shape to only what the API actually returns,
which keeps editor autocomplete useful and review diffs small.

Phase 3b (future) may add Prisma-derived types alongside — but only for
internal backend service code, not for shared cross-app DTOs.

## Layout

- `src/common.ts` — generic envelopes (`PaginatedResponse<T>`, `SuccessResponse`, etc.) + scalars used in 2+ files
- `src/storefront.ts` — public-facing types (Store, Product, Cart, Customer, Order, Templates)
- `src/admin.ts` — admin-side types (Organization, billing, lottery, RBAC, AI, payments, chat, vendor templates)
- `src/index.ts` — barrel export

Consumers should always import from the package root:

```ts
import type { Product, AdminUser, PaginatedResponse } from '@storeveu/types';
```

Never reach into `@storeveu/types/src/...`.

## Adding a new type

1. Pick the right module (`common`, `storefront`, or `admin`).
2. Mark fields the API **always returns** as required; everything else optional.
3. Use `number | string` for Prisma `Decimal` columns (axios returns them as
   strings sometimes).
4. Use ISO-string for dates over the wire — never `Date`.
5. Add the export to `src/index.ts` if it's a new module.

## Source-of-truth rule

When the backend response shape changes, update the matching type here in the
**same PR**. Reviewers should be flagging type-only PRs with no caller updates
as drift indicators.
