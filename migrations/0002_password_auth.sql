-- Username + password sign-in with server-side sessions.
-- Passwords are never stored: only PBKDF2-SHA256 hashes ("pbkdf2$iterations$salt$hash").
-- Accounts are created with scripts/create-user.ts (the password is not kept in the repo).

ALTER TABLE users ADD COLUMN username TEXT COLLATE NOCASE;
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN failed_logins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TEXT;
ALTER TABLE users ADD COLUMN password_changed_at TEXT;

CREATE UNIQUE INDEX idx_users_username ON users (username) WHERE username IS NOT NULL;

CREATE TABLE sessions (
  id          TEXT    PRIMARY KEY,             -- SHA-256 of the cookie token (token itself is never stored)
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT    NOT NULL,
  user_agent  TEXT
);
CREATE INDEX idx_sessions_user ON sessions (user_id);
CREATE INDEX idx_sessions_expires ON sessions (expires_at);
