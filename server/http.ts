import { ValidationError, type Body } from '../shared/validation';

export interface Env {
  DB: D1Database;
  /** e.g. "yourteam.cloudflareaccess.com" – enables JWT verification when set with ACCESS_AUD. */
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  /** Local development only (honoured on localhost). */
  DEV_USER_EMAIL?: string;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'ERROR',
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Item') => new HttpError(404, `${what} not found.`, 'NOT_FOUND');

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

const MAX_BODY_BYTES = 5 * 1024 * 1024;

export async function readBody(request: Request): Promise<Body> {
  const length = Number(request.headers.get('content-length') ?? '0');
  if (length > MAX_BODY_BYTES) throw new HttpError(413, 'That upload is too big (max 5 MB).');
  let parsed: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) throw new Error('too big');
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, 'The request body must be valid JSON.', 'BAD_JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new HttpError(400, 'The request body must be a JSON object.', 'BAD_JSON');
  }
  return parsed as Body;
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return json(
      { error: { message: err.message, code: err.code, details: err.details } },
      err.status,
    );
  }
  if (err instanceof ValidationError) {
    return json({ error: { message: err.message, code: 'VALIDATION', field: err.field } }, 400);
  }
  const message = err instanceof Error ? err.message : String(err);
  if (/UNIQUE constraint failed/i.test(message)) {
    return json({ error: { message: 'That already exists.', code: 'CONFLICT' } }, 409);
  }
  if (/FOREIGN KEY constraint failed/i.test(message)) {
    return json(
      {
        error: {
          message: 'This is still linked to other data. Move or remove that first.',
          code: 'IN_USE',
        },
      },
      409,
    );
  }
  console.error('Unhandled API error:', err);
  return json(
    {
      error: {
        message: 'Something went wrong on our side. Please try again in a moment.',
        code: 'SERVER',
      },
    },
    500,
  );
}
