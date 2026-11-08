// Identify the user. Cloudflare Access sits in front of the whole site and
// adds the "Cf-Access-Authenticated-User-Email" header after the email
// one-time-code login. If ACCESS_TEAM_DOMAIN and ACCESS_AUD are set we also
// cryptographically verify the Access JWT (recommended for production).
import { HttpError, type Env } from './http';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    throw new HttpError(
      401,
      'Your sign-in looks invalid. Please sign in again.',
      'UNAUTHENTICATED',
    );
  }
  return email;
}

function isLocalhost(request: Request): boolean {
  const host = new URL(request.url).hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

export async function getUserEmail(request: Request, env: Env): Promise<string> {
  if (env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD) {
    const token = request.headers.get('Cf-Access-Jwt-Assertion');
    if (!token) {
      throw new HttpError(401, 'Please sign in through Cloudflare Access.', 'UNAUTHENTICATED');
    }
    const payload = await verifyAccessJwt(token, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD);
    return normalizeEmail(payload.email);
  }

  const header = request.headers.get('Cf-Access-Authenticated-User-Email');
  if (header) return normalizeEmail(header);

  if (env.DEV_USER_EMAIL && isLocalhost(request)) return normalizeEmail(env.DEV_USER_EMAIL);

  throw new HttpError(401, 'Please sign in through Cloudflare Access.', 'UNAUTHENTICATED');
}

/* ---------------- Access JWT verification (RS256) ---------------- */

interface AccessJwk extends JsonWebKey {
  kid?: string;
}
interface JwtPayload {
  email: string;
  aud: string | string[];
  iss: string;
  exp: number;
  nbf?: number;
}

let keyCache: { domain: string; fetchedAt: number; keys: AccessJwk[] } | null = null;

async function getKeys(domain: string, force = false): Promise<AccessJwk[]> {
  const fresh =
    keyCache && keyCache.domain === domain && Date.now() - keyCache.fetchedAt < 3_600_000;
  if (!force && fresh && keyCache) return keyCache.keys;
  const res = await fetch(`https://${domain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new HttpError(503, 'Could not reach the sign-in service. Please try again.');
  const body = (await res.json()) as { keys?: AccessJwk[] };
  keyCache = { domain, fetchedAt: Date.now(), keys: body.keys ?? [] };
  return keyCache.keys;
}

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(s.length / 4) * 4, '=');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decodeJson<T>(segment: string): T {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(segment))) as T;
}

async function verifyAccessJwt(token: string, domain: string, aud: string): Promise<JwtPayload> {
  const invalid = () =>
    new HttpError(401, 'Your session has expired. Please sign in again.', 'UNAUTHENTICATED');
  const segments = token.split('.');
  if (segments.length !== 3) throw invalid();
  const [h, p, s] = segments as [string, string, string];

  let header: { alg?: string; kid?: string };
  let payload: JwtPayload;
  try {
    header = decodeJson(h);
    payload = decodeJson(p);
  } catch {
    throw invalid();
  }
  if (header.alg !== 'RS256') throw invalid();

  let jwk = (await getKeys(domain)).find((k) => k.kid === header.kid);
  if (!jwk) jwk = (await getKeys(domain, true)).find((k) => k.kid === header.kid);
  if (!jwk) throw invalid();

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64urlToBytes(s),
    new TextEncoder().encode(`${h}.${p}`),
  );
  if (!ok) throw invalid();

  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(aud)) throw invalid();
  if (payload.iss !== `https://${domain}`) throw invalid();
  if (typeof payload.exp !== 'number' || payload.exp < now) throw invalid();
  if (payload.nbf && payload.nbf > now + 60) throw invalid();
  if (typeof payload.email !== 'string') throw invalid();
  return payload;
}
