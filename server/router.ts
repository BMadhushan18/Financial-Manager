import { isValidISODate, utcTodayISO, daysBetween } from '../shared/finance';
import { accessEmail } from './auth';
import { getUserId } from './db';
import { errorResponse, HttpError, type Env } from './http';
import { sessionUser, type SessionInfo } from './session';

export interface Ctx {
  request: Request;
  env: Env;
  db: D1Database;
  url: URL;
  params: Record<string, string>;
  /** 0 on public routes. */
  userId: number;
  email: string;
  /** Present when signed in with username + password. */
  session: SessionInfo | null;
  /** Today in the user's time zone (sent by the app), checked to be within a day of UTC. */
  today: string;
}

type Handler = (c: Ctx) => Promise<Response>;

interface RouteOptions {
  /** No sign-in needed (login / logout). */
  public?: boolean;
  /** Reachable while the user still has to replace a temporary password. */
  allowWhenMustChange?: boolean;
}

interface Route extends RouteOptions {
  method: string;
  regex: RegExp;
  keys: string[];
  handler: Handler;
}

const routes: Route[] = [];

export function route(
  method: string,
  path: string,
  handler: Handler,
  opts: RouteOptions = {},
): void {
  const keys: string[] = [];
  const pattern = path.replace(/:([a-zA-Z_]+)/g, (_, key: string) => {
    keys.push(key);
    return '([^/]+)';
  });
  routes.push({ method, regex: new RegExp(`^${pattern}/?$`), keys, handler, ...opts });
}

function clientToday(request: Request): string {
  const utc = utcTodayISO();
  const sent = request.headers.get('X-Client-Date');
  if (sent && isValidISODate(sent) && Math.abs(daysBetween(utc, sent)) <= 1) return sent;
  return utc;
}

export async function dispatch(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    let matched: { route: Route; match: RegExpExecArray } | null = null;
    let pathExists = false;
    for (const r of routes) {
      const m = r.regex.exec(url.pathname);
      if (!m) continue;
      pathExists = true;
      if (r.method === method) {
        matched = { route: r, match: m };
        break;
      }
    }
    if (!matched) {
      throw pathExists
        ? new HttpError(405, 'Method not allowed.', 'METHOD')
        : new HttpError(404, 'Unknown API endpoint.', 'NOT_FOUND');
    }

    // CSRF protection: state-changing requests must come from this site.
    // (The session cookie is also SameSite=Lax.)
    if (method !== 'GET') {
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) throw new HttpError(403, 'Cross-site request blocked.');
    }

    if (!env.DB) throw new HttpError(500, 'Database is not connected. Bind D1 as "DB".');
    const params: Record<string, string> = {};
    matched.route.keys.forEach((k, i) => {
      params[k] = decodeURIComponent(matched.match[i + 1] ?? '');
    });
    const base = { request, env, db: env.DB, url, params, today: clientToday(request) };

    if (matched.route.public) {
      return await matched.route.handler({ ...base, userId: 0, email: '', session: null });
    }

    // 1) Username + password session cookie.
    const session = await sessionUser(env.DB, request);
    if (session) {
      if (session.mustChange && !matched.route.allowWhenMustChange) {
        throw new HttpError(
          403,
          'Please set a new password to continue.',
          'PASSWORD_CHANGE_REQUIRED',
        );
      }
      return await matched.route.handler({
        ...base,
        userId: session.userId,
        email: session.email,
        session,
      });
    }

    // 2) Cloudflare Access (only when configured) or local development email.
    const email = await accessEmail(request, env);
    if (!email) throw new HttpError(401, 'Please sign in.', 'UNAUTHENTICATED');
    const userId = await getUserId(env.DB, email);
    return await matched.route.handler({ ...base, userId, email, session: null });
  } catch (err) {
    return errorResponse(err);
  }
}
