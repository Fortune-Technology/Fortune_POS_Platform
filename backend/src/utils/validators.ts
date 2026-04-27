/**
 * Shared input validators for auth / pricing / contact fields.
 * Keep these rules server-authoritative — do not rely on frontend alone.
 */

// Simple RFC-5322-ish practical regex — rejects common garbage patterns.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// At least 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special char.
const PASSWORD_RE =
  /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-={}[\]:;"'<>,.?/\\|`~]).{8,128}$/;

// E.164-ish phone: digits, optional leading +, 7–15 total digits.
const PHONE_RE = /^\+?[0-9\s\-().]{7,20}$/;

/**
 * Validators return `null` on success, or an error message string on failure.
 * Keeping the legacy "string | null" return shape so existing call sites
 * (which check truthiness) keep working without any caller changes.
 */
export type ValidatorResult = string | null;

export function validateEmail(email: unknown): ValidatorResult {
  if (!email || typeof email !== 'string') return 'Email is required';
  if (email.length > 254) return 'Email is too long';
  if (!EMAIL_RE.test(email.trim())) return 'Invalid email format';
  return null;
}

export function validatePassword(password: unknown): ValidatorResult {
  if (!password || typeof password !== 'string') return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (password.length > 128) return 'Password is too long';
  if (!PASSWORD_RE.test(password)) {
    return 'Password must include uppercase, lowercase, number, and special character';
  }
  return null;
}

export function validatePhone(phone: unknown): ValidatorResult {
  if (phone == null || phone === '') return null; // optional
  if (typeof phone !== 'string') return 'Invalid phone';
  if (!PHONE_RE.test(phone.trim())) return 'Invalid phone format';
  const digitCount = phone.replace(/\D/g, '').length;
  if (digitCount < 7 || digitCount > 15) return 'Phone must have 7-15 digits';
  return null;
}

export interface ParsePriceOptions {
  min?: number;
  max?: number;
  allowNull?: boolean;
}

export type ParsePriceResult =
  | { ok: true; value: number | null }
  | { ok: false; error: string };

/**
 * Parse a price/amount value safely.
 * Rejects NaN, Infinity, negatives, scientific notation garbage.
 * Returns { ok: true, value } or { ok: false, error }.
 */
export function parsePrice(
  value: unknown,
  { min = 0, max = 999999, allowNull = true }: ParsePriceOptions = {},
): ParsePriceResult {
  if ((value === null || value === undefined || value === '') && allowNull) {
    return { ok: true, value: null };
  }
  // Reject obvious non-numeric strings (scientific notation, hex, etc.)
  if (typeof value === 'string' && !/^-?\d+(\.\d+)?$/.test(value.trim())) {
    return { ok: false, error: 'Invalid price format' };
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return { ok: false, error: 'Price must be a finite number' };
  }
  if (n < min) return { ok: false, error: `Price must be >= ${min}` };
  if (n > max) return { ok: false, error: `Price must be <= ${max}` };
  // Round to 4 decimals to match Prisma Decimal(10, 4)
  return { ok: true, value: Math.round(n * 10000) / 10000 };
}

/**
 * Express middleware helper — returns the first non-null validator result,
 * or null if all checks pass.
 */
export function runValidators(checks: ValidatorResult[]): ValidatorResult {
  for (const err of checks) {
    if (err) return err;
  }
  return null;
}
