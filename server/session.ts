// Cookie sessions for username + password sign-in.
// The browser holds a random token in an HttpOnly cookie; the database only
// stores its SHA-256, so a leaked database cannot be used to hijack sessions.

export const SESSION_COOKIE = 'mm_session';
export const SESSION_DAYS = 30;

export interface SessionInfo {
  userId: number;
  email: string;
  username: string | null;
  mustChange: boolean;
  sessionId: string;
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

/** Creates a session row and returns the Set-Cookie header value. */
export async function createSession(
  db: D1Database,
  userId: number,
  request: Request,
): Promise<string> {
  const token = newToken();
  const id = await sha256Hex(token);
  const agent = (request.headers.get('User-Agent') ?? '').slice(0, 200) || null;
  await db.batch([
    db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')"),
    db
      .prepare(
        `INSERT INTO sessions (id, user_id, expires_at, user_agent)
         VALUES (?, ?, datetime('now', '+${SESSION_DAYS} days'), ?)`,
      )
      .bind(id, userId, agent),
  ]);
  return sessionCookie(token);
}

/** The signed-in user for this request's session cookie, or null. */
export async function sessionUser(db: D1Database, request: Request): Promise<SessionInfo | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token || token.length > 100) return null;
  const id = await sha256Hex(token);
  const row = await db
    .prepare(
      `SELECT u.id, u.email, u.username, u.must_change_password
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > datetime('now')`,
    )
    .bind(id)
    .first<{ id: number; email: string; username: string | null; must_change_password: number }>();
  if (!row) return null;
  return {
    userId: row.id,
    email: row.email,
    username: row.username,
    mustChange: Number(row.must_change_password) === 1,
    sessionId: id,
  };
}

export async function deleteSession(db: D1Database, request: Request): Promise<void> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return;
  await db
    .prepare('DELETE FROM sessions WHERE id = ?')
    .bind(await sha256Hex(token))
    .run();
}
