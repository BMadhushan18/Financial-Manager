// Password hashing (PBKDF2-SHA256 via Web Crypto) and password rules.
// Works in Cloudflare Workers, browsers and Node 20+ (globalThis.crypto).

/** Cloudflare Workers allow at most 100,000 PBKDF2 iterations. */
export const PBKDF2_ITERATIONS = 100_000;
export const MIN_PASSWORD_LENGTH = 8;

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function derive(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/** "pbkdf2$100000$<salt b64>$<hash b64>" */
export async function hashPassword(
  password: string,
  iterations = PBKDF2_ITERATIONS,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, iterations);
  return `pbkdf2$${iterations}$${toB64(salt)}$${toB64(hash)}`;
}

/** Constant-time comparison of a password against a stored hash. */
export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > PBKDF2_ITERATIONS)
    return false;
  let salt: Uint8Array<ArrayBuffer>;
  let expected: Uint8Array;
  try {
    salt = fromB64(parts[2]!);
    expected = fromB64(parts[3]!);
  } catch {
    return false;
  }
  const actual = await derive(password, salt, iterations);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ expected[i]!;
  return diff === 0;
}

/** Returns a friendly error message, or null when the new password is acceptable. */
export function validateNewPassword(
  password: string,
  opts: { username?: string | null; current?: string | null } = {},
): string | null {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > 128) return 'Use at most 128 characters.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
    return 'Use at least one letter and one number.';
  if (opts.current && password === opts.current)
    return 'Choose a password different from the current one.';
  if (opts.username && password.toLowerCase().includes(opts.username.toLowerCase())) {
    return 'Do not include your username in the password.';
  }
  if (/^(password|12345678|qwerty|letmein)/i.test(password))
    return 'That password is too easy to guess.';
  return null;
}
