// Username + password sign-in, sign-out and password change.
import { hashPassword, validateNewPassword, verifyPassword } from '../../shared/password';
import { str } from '../../shared/validation';
import { defaultRowsStatements } from '../db';
import { HttpError, json, readBody } from '../http';
import { route } from '../router';
import { clearSessionCookie, createSession, deleteSession } from '../session';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
// Used when the username does not exist, so the response time does not reveal it.
const DUMMY_HASH =
  'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

const WRONG = () => new HttpError(401, 'Wrong username or password.', 'BAD_CREDENTIALS');

route(
  'POST',
  '/api/auth/login',
  async ({ db, request }) => {
    const b = await readBody(request);
    const username = str(b, 'username', { required: true, max: 100 })!;
    const password = typeof b.password === 'string' ? b.password : '';
    if (!password || password.length > 200) throw WRONG();

    const user = await db
      .prepare(
        `SELECT id, password_hash, must_change_password, failed_logins,
                CASE WHEN locked_until > datetime('now')
                     THEN CAST((julianday(locked_until) - julianday('now')) * 1440 + 1 AS INTEGER) END AS locked_minutes
         FROM users WHERE username = ?`,
      )
      .bind(username)
      .first<{
        id: number;
        password_hash: string | null;
        must_change_password: number;
        failed_logins: number;
        locked_minutes: number | null;
      }>();

    if (!user || !user.password_hash) {
      await verifyPassword(password, DUMMY_HASH);
      throw WRONG();
    }
    if (user.locked_minutes) {
      throw new HttpError(
        429,
        `Too many wrong attempts. Please try again in ${user.locked_minutes} minute(s).`,
        'LOCKED',
      );
    }
    if (!(await verifyPassword(password, user.password_hash))) {
      const failed = Number(user.failed_logins) + 1;
      if (failed >= MAX_FAILED) {
        await db
          .prepare(
            `UPDATE users SET failed_logins = 0, locked_until = datetime('now', '+${LOCK_MINUTES} minutes') WHERE id = ?`,
          )
          .bind(user.id)
          .run();
        throw new HttpError(
          429,
          `Too many wrong attempts. Sign-in is paused for ${LOCK_MINUTES} minutes.`,
          'LOCKED',
        );
      }
      await db
        .prepare('UPDATE users SET failed_logins = ? WHERE id = ?')
        .bind(failed, user.id)
        .run();
      throw WRONG();
    }

    await db.batch([
      db
        .prepare('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?')
        .bind(user.id),
      ...defaultRowsStatements(db, user.id), // make sure settings + categories exist
    ]);
    const cookie = await createSession(db, user.id, request);
    const res = json({ ok: true, must_change_password: Number(user.must_change_password) === 1 });
    res.headers.append('Set-Cookie', cookie);
    return res;
  },
  { public: true },
);

route(
  'POST',
  '/api/auth/logout',
  async ({ db, request }) => {
    await deleteSession(db, request);
    const res = json({ ok: true });
    res.headers.append('Set-Cookie', clearSessionCookie());
    return res;
  },
  { public: true },
);

route(
  'POST',
  '/api/auth/change-password',
  async ({ db, request, session }) => {
    if (!session) {
      throw new HttpError(400, 'Password sign-in is not set up for this account.', 'NO_PASSWORD');
    }
    const b = await readBody(request);
    const current = typeof b.current_password === 'string' ? b.current_password : '';
    const next = typeof b.new_password === 'string' ? b.new_password : '';
    const row = await db
      .prepare('SELECT password_hash FROM users WHERE id = ?')
      .bind(session.userId)
      .first<{ password_hash: string | null }>();
    if (!(await verifyPassword(current, row?.password_hash))) {
      throw new HttpError(400, 'Your current password is not correct.', 'BAD_CURRENT');
    }
    const problem = validateNewPassword(next, { username: session.username, current });
    if (problem) throw new HttpError(400, problem, 'WEAK_PASSWORD');

    await db.batch([
      db
        .prepare(
          `UPDATE users SET password_hash = ?, must_change_password = 0, password_changed_at = datetime('now'),
             failed_logins = 0, locked_until = NULL WHERE id = ?`,
        )
        .bind(await hashPassword(next), session.userId),
      // Sign out every other device.
      db
        .prepare('DELETE FROM sessions WHERE user_id = ? AND id <> ?')
        .bind(session.userId, session.sessionId),
    ]);
    return json({ ok: true });
  },
  { allowWhenMustChange: true },
);
