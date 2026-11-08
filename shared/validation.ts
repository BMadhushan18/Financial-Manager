// Small input validators used by the API (server-side validation).
import { isValidISODate, MAX_CENTS } from './finance';

export class ValidationError extends Error {
  constructor(
    public field: string,
    message: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export type Body = Record<string, unknown>;

export function has(body: Body, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined;
}

interface Opts {
  required?: boolean;
}

function missing(field: string): never {
  throw new ValidationError(field, `Please fill in ${field.replace(/_/g, ' ')}.`);
}

export function str(body: Body, key: string, opts: Opts & { max?: number } = {}): string | null {
  const raw = body[key];
  if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) {
    if (opts.required) missing(key);
    return null;
  }
  if (typeof raw !== 'string') throw new ValidationError(key, `${key} must be text.`);
  const value = raw.trim();
  const max = opts.max ?? 200;
  if (value.length > max) {
    throw new ValidationError(key, `${key.replace(/_/g, ' ')} can be at most ${max} characters.`);
  }
  return value;
}

export function int(
  body: Body,
  key: string,
  opts: Opts & { min?: number; max?: number } = {},
): number | null {
  const raw = body[key];
  if (raw === undefined || raw === null || raw === '') {
    if (opts.required) missing(key);
    return null;
  }
  if (typeof raw !== 'number' || !Number.isInteger(raw)) {
    throw new ValidationError(key, `${key.replace(/_/g, ' ')} must be a whole number.`);
  }
  if (opts.min !== undefined && raw < opts.min) {
    throw new ValidationError(key, `${key.replace(/_/g, ' ')} must be at least ${opts.min}.`);
  }
  if (opts.max !== undefined && raw > opts.max) {
    throw new ValidationError(key, `${key.replace(/_/g, ' ')} must be at most ${opts.max}.`);
  }
  return raw;
}

/** Integer cents. Floats are rejected so money never goes through floating point. */
export function cents(
  body: Body,
  key: string,
  opts: Opts & { allowNegative?: boolean; allowZero?: boolean } = {},
): number | null {
  const value = int(body, key, {
    required: opts.required,
    min: opts.allowNegative ? -MAX_CENTS : 0,
    max: MAX_CENTS,
  });
  if (value === 0 && opts.allowZero === false) {
    throw new ValidationError(key, 'Amount must be more than zero.');
  }
  return value;
}

export function date(body: Body, key: string, opts: Opts = {}): string | null {
  const raw = body[key];
  if (raw === undefined || raw === null || raw === '') {
    if (opts.required) missing(key);
    return null;
  }
  if (!isValidISODate(raw)) {
    throw new ValidationError(key, `${key.replace(/_/g, ' ')} must be a valid date (YYYY-MM-DD).`);
  }
  return raw;
}

export function oneOf<T extends string>(
  body: Body,
  key: string,
  values: readonly T[],
  opts: Opts = {},
): T | null {
  const raw = body[key];
  if (raw === undefined || raw === null || raw === '') {
    if (opts.required) missing(key);
    return null;
  }
  if (typeof raw !== 'string' || !values.includes(raw as T)) {
    throw new ValidationError(
      key,
      `${key.replace(/_/g, ' ')} must be one of: ${values.join(', ')}.`,
    );
  }
  return raw as T;
}

export function bool(body: Body, key: string): boolean | null {
  const raw = body[key];
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'boolean') throw new ValidationError(key, `${key} must be true or false.`);
  return raw;
}

export function url(body: Body, key: string): string | null {
  const value = str(body, key, { max: 500 });
  if (value === null) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('bad protocol');
  } catch {
    throw new ValidationError(key, 'Link must start with http:// or https://');
  }
  return value;
}

export function color(body: Body, key: string): string | null {
  const value = str(body, key, { max: 7 });
  if (value === null) return null;
  if (!/^#[0-9a-fA-F]{6}$/.test(value))
    throw new ValidationError(key, 'Color must look like #6366F1.');
  return value;
}

/** Parse a positive integer id from a route parameter. */
export function idParam(raw: string | undefined, field = 'id'): number {
  const n = Number(raw);
  if (!raw || !/^\d+$/.test(raw) || !Number.isSafeInteger(n) || n <= 0) {
    throw new ValidationError(field, `Invalid ${field}.`);
  }
  return n;
}
