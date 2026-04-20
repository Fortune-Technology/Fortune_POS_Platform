/**
 * safeParseDate(value, fieldName) — parse user-supplied date input safely.
 *
 * Returns a valid `Date` object OR `null`. Throws a `ValidationError` when
 * the input cannot be reasonably interpreted as a date — so callers can
 * surface a 400 (not 500).
 *
 * Handles:
 *   • null / undefined / '' → returns null
 *   • ISO strings (standard + extended +YYYYYY form)
 *   • milliseconds numbers
 *   • Date instances
 *   • Prisma's `{$type: 'DateTime', value: '...'}` wrapper
 *
 * Rejects:
 *   • Invalid Date (e.g. 'hello')
 *   • Years < 1900 or > 2100 — almost certainly typos (e.g. user typed
 *     20001 instead of 2001)
 */
export class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.statusCode = 400;
  }
}

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

export function safeParseDate(value, fieldName = 'date') {
  if (value == null || value === '') return null;

  // Unwrap Prisma's internal type marker if it somehow reaches us
  if (typeof value === 'object' && !(value instanceof Date)) {
    if (value.$type === 'DateTime' && typeof value.value === 'string') {
      value = value.value;
    } else {
      throw new ValidationError(`Invalid ${fieldName}: unexpected object shape`, fieldName);
    }
  }

  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) {
    throw new ValidationError(`Invalid ${fieldName}: "${String(value).slice(0, 40)}"`, fieldName);
  }

  const year = d.getUTCFullYear();
  if (year < MIN_YEAR || year > MAX_YEAR) {
    throw new ValidationError(
      `${fieldName} year out of range (${MIN_YEAR}-${MAX_YEAR}): got ${year}`,
      fieldName,
    );
  }

  return d;
}

/**
 * Express-friendly wrapper: calls safeParseDate, catches ValidationError,
 * sends a 400. Returns `{ ok: true, value }` or `{ ok: false }` (response
 * already sent).
 */
export function tryParseDate(res, value, fieldName) {
  try {
    return { ok: true, value: safeParseDate(value, fieldName) };
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({ success: false, error: err.message, field: err.field });
      return { ok: false };
    }
    throw err;
  }
}
