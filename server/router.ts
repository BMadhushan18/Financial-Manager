import { isValidISODate, utcTodayISO, daysBetween } from '../shared/finance';
import { getUserEmail } from './auth';
import { getUserId } from './db';
import { errorResponse, HttpError, type Env } from './http';

export interface Ctx {
  request: Request;
  env: Env;
  db: D1Database;
  url: URL;
  params: Record<string, string>;
  userId: number;
  email: string;
  /** Today in the user's time zone (sent by the app), checked to be within a day of UTC. */
  today: string;
}

type Handler = (c: Ctx) => Promise<Response>;

interface Route {
  method: string;
  regex: RegExp;
  keys: string[];
  handler: Handler;
}

const routes: Route[] = [];

export function route(method: string, path: string, handler: Handler): void {
  const keys: string[] = [];
  const pattern = path.replace(/:([a-zA-Z_]+)/g, (_, key: string) => {
    keys.push(key);
    return '([^/]+)';
  });
  routes.push({ method, regex: new RegExp(`^${pattern}/?$`), keys, handler });
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

    // Basic CSRF protection: state-changing requests must be same-origin JSON.
    if (method !== 'GET') {
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) throw new HttpError(403, 'Cross-site request blocked.');
    }

    if (!env.DB) throw new HttpError(500, 'Database is not connected. Bind D1 as "DB".');
    const email = await getUserEmail(request, env);
    const userId = await getUserId(env.DB, email);
    const params: Record<string, string> = {};
    matched.route.keys.forEach((k, i) => {
      params[k] = decodeURIComponent(matched.match[i + 1] ?? '');
    });
    return await matched.route.handler({
      request,
      env,
      db: env.DB,
      url,
      params,
      userId,
      email,
      today: clientToday(request),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
