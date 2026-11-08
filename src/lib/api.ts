import { localTodayISO } from '../../shared/finance';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

interface Options {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  keepalive?: boolean;
}

/** JSON fetch with friendly errors. Sends the device date so cycles match local time. */
export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? 'GET',
      headers: {
        'content-type': 'application/json',
        'X-Client-Date': localTodayISO(),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      keepalive: opts.keepalive,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(
      'You seem to be offline. Check your connection and try again.',
      0,
      'OFFLINE',
    );
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Cloudflare Access may answer with an HTML login page when the session expired.
    if (res.ok || res.status === 302 || res.redirected) {
      throw new ApiError(
        'Your sign-in has expired. Reload the page to sign in again.',
        401,
        'UNAUTHENTICATED',
      );
    }
  }
  if (!res.ok) {
    const err = (
      data as {
        error?: { message?: string; code?: string; details?: Record<string, unknown> };
      } | null
    )?.error;
    throw new ApiError(
      err?.message ?? `Something went wrong (${res.status}). Please try again.`,
      res.status,
      err?.code ?? 'ERROR',
      err?.details,
    );
  }
  return data as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}
