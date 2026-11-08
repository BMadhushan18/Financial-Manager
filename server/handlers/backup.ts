// Export / import a JSON backup, and delete all data.
import { CURRENCIES } from '../../shared/defaults';
import { isValidSplit } from '../../shared/finance';
import { defaultRowsStatements } from '../db';
import { HttpError, json, readBody } from '../http';
import { route } from '../router';

type Row = Record<string, unknown>;

interface TableDef {
  name: string;
  cols: string[];
  /** column → table whose ids it points at (remapped on import) */
  refs?: Record<string, string>;
}

/** Order matters: parents before children. */
const TABLES: TableDef[] = [
  {
    name: 'categories',
    cols: [
      'id',
      'name',
      'type',
      'priority',
      'icon',
      'color',
      'monthly_limit_cents',
      'is_default',
      'is_archived',
      'created_at',
    ],
  },
  {
    name: 'income_entries',
    cols: ['id', 'date', 'source', 'amount_cents', 'status', 'note', 'created_at'],
  },
  {
    name: 'fixed_bills',
    cols: ['id', 'name', 'amount_cents', 'due_day', 'category_id', 'is_active', 'created_at'],
    refs: { category_id: 'categories' },
  },
  {
    name: 'wishlist_items',
    cols: [
      'id',
      'name',
      'category_id',
      'type',
      'priority',
      'urgency',
      'estimated_cents',
      'quantity',
      'link',
      'note',
      'status',
      'prev_status',
      'added_at',
      'target_cycle',
      'reminder_date',
      'bought_at',
      'actual_cents',
      'payment_method',
      'dropped_at',
      'repeat_of',
      'updated_at',
    ],
    refs: { category_id: 'categories', repeat_of: 'wishlist_items' },
  },
  {
    name: 'wishlist_price_history',
    cols: ['id', 'item_id', 'price_cents', 'changed_at'],
    refs: { item_id: 'wishlist_items' },
  },
  {
    name: 'expenses',
    cols: [
      'id',
      'amount_cents',
      'date',
      'category_id',
      'type',
      'payment_method',
      'note',
      'wishlist_item_id',
      'fixed_bill_id',
      'refund_of',
      'created_at',
      'updated_at',
    ],
    refs: {
      category_id: 'categories',
      wishlist_item_id: 'wishlist_items',
      fixed_bill_id: 'fixed_bills',
      refund_of: 'expenses',
    },
  },
  {
    name: 'bill_payments',
    cols: ['id', 'bill_id', 'cycle_start', 'amount_cents', 'paid_at', 'expense_id'],
    refs: { bill_id: 'fixed_bills', expense_id: 'expenses' },
  },
  { name: 'savings_moves', cols: ['id', 'date', 'amount_cents', 'note', 'created_at'] },
  {
    name: 'purchase_checks',
    cols: ['id', 'wishlist_item_id', 'amount_cents', 'type', 'warnings', 'choice', 'created_at'],
    refs: { wishlist_item_id: 'wishlist_items' },
  },
  { name: 'cycles', cols: ['id', 'start_date', 'end_date', 'closed_at', 'summary'] },
];

const DEFAULTS: Record<string, string> = {
  created_at: "datetime('now')",
  updated_at: "datetime('now')",
  is_default: '0',
  is_archived: '0',
  is_active: '1',
  quantity: '1',
  priority: "'MEDIUM'",
  icon: "'🏷️'",
  color: "'#94A3B8'",
  warnings: "'[]'",
  urgency: "'SOMEDAY'",
  status_default: "'IDEA'",
};

const SETTINGS_COLS = [
  'salary_day',
  'cycle_mode',
  'currency',
  'salary_cents',
  'split_needs',
  'split_wants',
  'split_savings',
  'warnings_enabled',
  'big_want_percent',
  'cooling_days',
  'emergency_months',
  'emergency_target_cents',
  'onboarded',
];

/** Child → parent order for deleting a user's data. */
const DELETE_ORDER = [
  'purchase_checks',
  'bill_payments',
  'wishlist_price_history',
  'expenses',
  'wishlist_items',
  'fixed_bills',
  'income_entries',
  'savings_moves',
  'cycles',
  'categories',
  'savings_goals',
  'settings',
];

function deleteStatements(db: D1Database, userId: number): D1PreparedStatement[] {
  return DELETE_ORDER.map((t) => db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).bind(userId));
}

route('GET', '/api/export', async ({ db, userId, email }) => {
  const stmts = [
    db.prepare('SELECT * FROM settings WHERE user_id = ?').bind(userId),
    db.prepare('SELECT * FROM savings_goals WHERE user_id = ?').bind(userId),
    ...TABLES.map((t) =>
      db.prepare(`SELECT * FROM ${t.name} WHERE user_id = ? ORDER BY id`).bind(userId),
    ),
  ];
  const results = await db.batch<Row>(stmts);
  const strip = (r: Row) => {
    const copy = { ...r };
    delete copy.user_id;
    return copy;
  };
  const data: Record<string, unknown> = {
    settings: results[0]?.results[0] ? strip(results[0].results[0]) : null,
    savings_goal: results[1]?.results[0] ? strip(results[1].results[0]) : null,
  };
  TABLES.forEach((t, i) => {
    data[t.name] = (results[i + 2]?.results ?? []).map(strip);
  });
  return json({ app: 'moneymind', version: 1, exported_at: new Date().toISOString(), email, data });
});

/** Replace ALL of this user's data with a backup. Ids are remapped so they never clash. */
route('POST', '/api/import', async ({ db, userId, request }) => {
  const body = await readBody(request);
  if (
    body.app !== 'moneymind' ||
    body.version !== 1 ||
    typeof body.data !== 'object' ||
    body.data === null
  ) {
    throw new HttpError(400, 'This file is not a MoneyMind backup.', 'BAD_BACKUP');
  }
  if (body.confirm !== 'REPLACE') {
    throw new HttpError(400, 'Please confirm that this replaces all your current data.', 'CONFIRM');
  }
  const data = body.data as Record<string, unknown>;

  // Validate shape: arrays of objects with positive integer ids.
  const rows: Record<string, Row[]> = {};
  for (const t of TABLES) {
    const list = data[t.name] ?? [];
    if (!Array.isArray(list))
      throw new HttpError(400, `Backup part "${t.name}" is broken.`, 'BAD_BACKUP');
    for (const r of list) {
      if (
        typeof r !== 'object' ||
        r === null ||
        !Number.isSafeInteger((r as Row).id) ||
        Number((r as Row).id) <= 0
      ) {
        throw new HttpError(400, `Backup part "${t.name}" has a broken row.`, 'BAD_BACKUP');
      }
      for (const [col, target] of Object.entries(t.refs ?? {})) {
        const v = (r as Row)[col];
        if (v !== null && v !== undefined && (!Number.isSafeInteger(v) || Number(v) <= 0)) {
          throw new HttpError(
            400,
            `Backup part "${t.name}" has a broken link to ${target}.`,
            'BAD_BACKUP',
          );
        }
      }
    }
    rows[t.name] = [...(list as Row[])].sort((a, b) => Number(a.id) - Number(b.id));
  }

  // New id = old id + current max id of that table → never collides with other users' rows.
  const maxRow = await db
    .prepare(
      `SELECT ${TABLES.map((t) => `(SELECT COALESCE(MAX(id), 0) FROM ${t.name}) AS ${t.name}`).join(', ')}`,
    )
    .first<Record<string, number>>();
  const offset = (table: string) => Number(maxRow?.[table] ?? 0);

  const stmts: D1PreparedStatement[] = [
    db.prepare('PRAGMA defer_foreign_keys = true'),
    ...deleteStatements(db, userId),
  ];
  stmts.push(...defaultRowsStatements(db, userId).slice(0, 2)); // settings + savings goal rows

  for (const t of TABLES) {
    const list = rows[t.name] ?? [];
    if (list.length === 0) continue;
    const select = t.cols.map((col) => {
      const ex = `json_extract(value, '$.${col}')`;
      if (col === 'id') return `${ex} + ${offset(t.name)}`;
      const ref = t.refs?.[col];
      if (ref) return `${ex} + ${offset(ref)}`;
      const def = DEFAULTS[col];
      return def ? `COALESCE(${ex}, ${def})` : ex;
    });
    stmts.push(
      db
        .prepare(
          `INSERT INTO ${t.name} (user_id, ${t.cols.join(', ')}) SELECT ?, ${select.join(', ')} FROM json_each(?)`,
        )
        .bind(userId, JSON.stringify(list)),
    );
  }

  // Settings and savings goal (validated).
  const s = (data.settings ?? null) as Row | null;
  if (s && typeof s === 'object') {
    const split = [Number(s.split_needs), Number(s.split_wants), Number(s.split_savings)] as const;
    if (isValidSplit(...split) && CURRENCIES.some((c) => c.code === s.currency)) {
      stmts.push(
        db
          .prepare(
            `UPDATE settings SET ${SETTINGS_COLS.map((c) => `${c} = ?`).join(', ')}, onboarded = 1 WHERE user_id = ?`,
          )
          .bind(...SETTINGS_COLS.map((c) => (s[c] === undefined ? null : s[c])), userId),
      );
    }
  }
  const g = (data.savings_goal ?? null) as Row | null;
  if (g && typeof g === 'object' && (g.mode === 'amount' || g.mode === 'percent')) {
    stmts.push(
      db
        .prepare(
          'UPDATE savings_goals SET mode = ?, amount_cents = ?, percent = ? WHERE user_id = ?',
        )
        .bind(
          g.mode,
          Number(g.amount_cents) || 0,
          Math.min(Math.max(Number(g.percent) || 0, 0), 100),
          userId,
        ),
    );
  }

  try {
    await db.batch(stmts);
  } catch (err) {
    console.error('Import failed', err);
    throw new HttpError(
      400,
      'Import failed and nothing was changed. The backup may be damaged or from a different version.',
      'IMPORT_FAILED',
    );
  }
  // Ensure default categories exist if the backup had none.
  if ((rows.categories ?? []).length === 0) await db.batch(defaultRowsStatements(db, userId));
  return json({
    ok: true,
    counts: Object.fromEntries(TABLES.map((t) => [t.name, (rows[t.name] ?? []).length])),
  });
});

/** Delete ALL of this user's data (double-confirmed in the app). */
route('DELETE', '/api/data', async ({ db, userId, request }) => {
  const body = await readBody(request);
  if (body.confirm !== 'DELETE') {
    throw new HttpError(400, 'Please type DELETE to confirm.', 'CONFIRM');
  }
  await db.batch([
    db.prepare('PRAGMA defer_foreign_keys = true'),
    ...deleteStatements(db, userId),
    ...defaultRowsStatements(db, userId),
  ]);
  return json({ ok: true });
});
