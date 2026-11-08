// Create (or reset) a username + password account directly in D1.
// The password is hashed here and never written to the repository.
//
//   USER_PASSWORD='temporary-pass' npx tsx scripts/create-user.ts \
//       --username alice --email alice@example.com --remote
//
// Options:
//   --username <name>   required, 3–100 chars (letters, numbers, . _ -)
//   --email <email>     required; links the account to its data
//   --password <pass>   or set USER_PASSWORD (preferred – keeps it out of shell history)
//   --remote | --local  which D1 database (default: --local)
//   --permanent         do NOT force a password change at first sign-in
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_CATEGORIES } from '../shared/defaults';
import { hashPassword } from '../shared/password';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const username = arg('username')?.trim();
const email = arg('email')?.trim().toLowerCase();
const password = process.env.USER_PASSWORD ?? arg('password');
const target = flag('remote') ? '--remote' : '--local';
const mustChange = flag('permanent') ? 0 : 1;

if (!username || !/^[A-Za-z0-9._-]{3,100}$/.test(username)) {
  console.error('Please give --username (3–100 letters, numbers, . _ -).');
  process.exit(1);
}
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Please give a valid --email.');
  process.exit(1);
}
if (!password || password.length < 6) {
  console.error('Please give a password (USER_PASSWORD env or --password), at least 6 characters.');
  process.exit(1);
}

const q = (v: string) => `'${v.replace(/'/g, "''")}'`;
const U = `(SELECT id FROM users WHERE email = ${q(email)})`;
const hash = await hashPassword(password);

const sql = [
  `INSERT INTO users (email, username, password_hash, must_change_password)
   VALUES (${q(email)}, ${q(username)}, ${q(hash)}, ${mustChange})
   ON CONFLICT(email) DO UPDATE SET username = excluded.username, password_hash = excluded.password_hash,
     must_change_password = excluded.must_change_password, failed_logins = 0, locked_until = NULL;`,
  `DELETE FROM sessions WHERE user_id = ${U};`,
  `INSERT OR IGNORE INTO settings (user_id) VALUES (${U});`,
  `INSERT OR IGNORE INTO savings_goals (user_id, mode, percent) VALUES (${U}, 'percent', 20);`,
  ...DEFAULT_CATEGORIES.map(
    (c) =>
      `INSERT OR IGNORE INTO categories (user_id, name, type, priority, icon, color, is_default)
       VALUES (${U}, ${q(c.name)}, ${q(c.type)}, ${q(c.priority)}, ${q(c.icon)}, ${q(c.color)}, 1);`,
  ),
].join('\n');

const dir = mkdtempSync(join(tmpdir(), 'moneymind-'));
const file = join(dir, 'user.sql');
try {
  writeFileSync(file, sql);
  execSync(`npx wrangler d1 execute moneymind ${target} --file="${file}"`, {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  console.log(
    `Account "${username}" (${email}) is ready in the ${target.slice(2)} database.` +
      (mustChange ? ' A new password will be required at first sign-in.' : ''),
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
