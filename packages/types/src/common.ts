/**
 * Generic API envelope types and scalars shared across multiple modules.
 *
 * Anything that's referenced by both `storefront.ts` and `admin.ts` lives here
 * to avoid circular re-exports. If a type is only used in one module, keep it
 * in that module's file.
 */

// ─── Pagination envelopes ────────────────────────────────────────────────────

/**
 * `{ data: T[], total: N }` — used by paginated list endpoints with a simple
 * total-count field. The most common pagination shape across both backends.
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

/**
 * `{ data: T[], meta: { total, page, limit } }` — used by billing/invoices and
 * other endpoints where richer pagination metadata is returned.
 */
export interface MetaPaginatedResponse<T> {
  data: T[];
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

// ─── Acknowledgement envelope ────────────────────────────────────────────────

/**
 * `{ success: true, message?: string }` — generic mutation/action ack used by
 * delete endpoints and side-effect-only endpoints.
 */
export interface SuccessResponse {
  success: boolean;
  message?: string;
}

// ─── Identity scalars ────────────────────────────────────────────────────────

/**
 * Hierarchical user role. Resolved server-side; clients should treat unknown
 * strings as `'cashier'` for safety.
 */
export type UserRole =
  | 'staff'
  | 'cashier'
  | 'manager'
  | 'owner'
  | 'admin'
  | 'superadmin';

/** User account state. */
export type UserStatus = 'pending' | 'active' | 'suspended';

// ─── Wire-format scalars ─────────────────────────────────────────────────────

/**
 * Prisma `Decimal` columns over the wire. Axios deserializes them inconsistently —
 * sometimes a number (when small), sometimes a string (to preserve precision).
 * Always coerce with `Number(...)` before doing math.
 */
export type DecimalString = number | string;

/**
 * ISO-8601 date-time string. Use this in interfaces instead of `Date` — every
 * date traveling over JSON arrives as a string and only becomes a `Date` if
 * the consumer explicitly parses it.
 */
export type IsoDate = string;
