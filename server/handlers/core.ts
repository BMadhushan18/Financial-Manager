// Bootstrap, settings, categories, income, fixed bills and savings.
import { CURRENCIES } from '../../shared/defaults';
import { getCycle, isValidSplit } from '../../shared/finance';
import {
  ENTRY_TYPES,
  INCOME_SOURCES,
  PAYMENT_METHODS,
  PRIORITIES,
  type BootstrapResponse,
} from '../../shared/types';
import {
  bool,
  cents,
  color,
  date,
  has,
  idParam,
  int,
  oneOf,
  str,
  ValidationError,
} from '../../shared/validation';
import {
  assertOwned,
  getSettings,
  mapBill,
  mapCategory,
  mapGoal,
  mapIncome,
  mapMove,
  mapSettings,
} from '../db';
import { HttpError, json, notFound, readBody } from '../http';
import { route, type Ctx } from '../router';

type Row = Record<string, unknown>;

/* ---------------- bootstrap & settings ---------------- */

route('GET', '/api/bootstrap', async ({ db, userId, email, session }) => {
  const [settings, cats, bills, goal] = await db.batch<Row>([
    db.prepare('SELECT * FROM settings WHERE user_id = ?').bind(userId),
    db
      .prepare('SELECT * FROM categories WHERE user_id = ? ORDER BY is_archived, type, name')
      .bind(userId),
    db
      .prepare('SELECT * FROM fixed_bills WHERE user_id = ? ORDER BY is_active DESC, due_day, id')
      .bind(userId),
    db.prepare('SELECT * FROM savings_goals WHERE user_id = ?').bind(userId),
  ]);
  const body: BootstrapResponse = {
    email,
    username: session?.username ?? null,
    auth_method: session ? 'password' : 'access',
    settings: settings?.results[0]
      ? mapSettings(settings.results[0])
      : await getSettings(db, userId),
    categories: (cats?.results ?? []).map(mapCategory),
    bills: (bills?.results ?? []).map(mapBill),
    savings_goal: mapGoal(goal?.results[0] ?? null),
  };
  return json(body);
});

route('PUT', '/api/settings', async ({ db, userId, request, today }) => {
  const b = await readBody(request);
  const current = await getSettings(db, userId);
  const next = {
    salary_day: int(b, 'salary_day', { min: 1, max: 31 }) ?? current.salary_day,
    cycle_mode: oneOf(b, 'cycle_mode', ['salary', 'calendar'] as const) ?? current.cycle_mode,
    currency: str(b, 'currency', { max: 3 }) ?? current.currency,
    salary_cents: cents(b, 'salary_cents') ?? current.salary_cents,
    split_needs: int(b, 'split_needs', { min: 0, max: 100 }) ?? current.split_needs,
    split_wants: int(b, 'split_wants', { min: 0, max: 100 }) ?? current.split_wants,
    split_savings: int(b, 'split_savings', { min: 0, max: 100 }) ?? current.split_savings,
    warnings_enabled: bool(b, 'warnings_enabled') ?? current.warnings_enabled,
    big_want_percent: int(b, 'big_want_percent', { min: 1, max: 100 }) ?? current.big_want_percent,
    cooling_days: int(b, 'cooling_days', { min: 0, max: 90 }) ?? current.cooling_days,
    emergency_months: int(b, 'emergency_months', { min: 0, max: 24 }) ?? current.emergency_months,
    emergency_target_cents: has(b, 'emergency_target_cents')
      ? cents(b, 'emergency_target_cents')
      : current.emergency_target_cents,
    onboarded: bool(b, 'onboarded') ?? current.onboarded,
  };
  if (!CURRENCIES.some((c) => c.code === next.currency)) {
    throw new ValidationError('currency', 'Please pick a currency from the list.');
  }
  if (!isValidSplit(next.split_needs, next.split_wants, next.split_savings)) {
    throw new ValidationError('split_needs', 'Needs, wants and savings must add up to 100%.');
  }
  // When the salary amount changes, update this cycle's expected salary too.
  const salaryChanged = next.salary_cents !== current.salary_cents;
  await db
    .prepare(
      `UPDATE settings SET salary_day = ?, cycle_mode = ?, currency = ?, salary_cents = ?,
         split_needs = ?, split_wants = ?, split_savings = ?, warnings_enabled = ?,
         big_want_percent = ?, cooling_days = ?, emergency_months = ?, emergency_target_cents = ?,
         onboarded = ?, last_salary_cycle = CASE WHEN ? THEN NULL ELSE last_salary_cycle END,
         updated_at = datetime('now')
       WHERE user_id = ?`,
    )
    .bind(
      next.salary_day,
      next.cycle_mode,
      next.currency,
      next.salary_cents,
      next.split_needs,
      next.split_wants,
      next.split_savings,
      next.warnings_enabled ? 1 : 0,
      next.big_want_percent,
      next.cooling_days,
      next.emergency_months,
      next.emergency_target_cents,
      next.onboarded ? 1 : 0,
      salaryChanged ? 1 : 0,
      userId,
    )
    .run();
  if (salaryChanged) {
    const cycle = getCycle(today, next.salary_day, next.cycle_mode);
    await db
      .prepare(
        `UPDATE income_entries SET amount_cents = ?
         WHERE user_id = ? AND source = 'salary' AND status = 'expected' AND date BETWEEN ? AND ?`,
      )
      .bind(next.salary_cents, userId, cycle.start, cycle.end)
      .run();
  }
  return json({ settings: await getSettings(db, userId) });
});

/* ---------------- categories ---------------- */

route('GET', '/api/categories', async ({ db, userId }) => {
  const res = await db
    .prepare('SELECT * FROM categories WHERE user_id = ? ORDER BY is_archived, type, name')
    .bind(userId)
    .all<Row>();
  return json({ categories: res.results.map(mapCategory) });
});

function categoryFields(b: Record<string, unknown>, required: boolean) {
  return {
    name: str(b, 'name', { required, max: 40 }),
    type: oneOf(b, 'type', ENTRY_TYPES, { required }),
    priority: oneOf(b, 'priority', PRIORITIES),
    icon: str(b, 'icon', { max: 8 }),
    color: color(b, 'color'),
    monthly_limit_cents: cents(b, 'monthly_limit_cents'),
    is_archived: bool(b, 'is_archived'),
  };
}

route('POST', '/api/categories', async ({ db, userId, request }) => {
  const f = categoryFields(await readBody(request), true);
  const row = await db
    .prepare(
      `INSERT INTO categories (user_id, name, type, priority, icon, color, monthly_limit_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    )
    .bind(
      userId,
      f.name,
      f.type,
      f.priority ?? 'MEDIUM',
      f.icon ?? '🏷️',
      f.color ?? '#94A3B8',
      f.monthly_limit_cents,
    )
    .first<Row>();
  return json({ category: mapCategory(row!) }, 201);
});

route('PUT', '/api/categories/:id', async ({ db, userId, request, params }) => {
  const id = idParam(params.id);
  const b = await readBody(request);
  const f = categoryFields(b, false);
  const row = await db
    .prepare(
      `UPDATE categories SET
         name = COALESCE(?, name), type = COALESCE(?, type), priority = COALESCE(?, priority),
         icon = COALESCE(?, icon), color = COALESCE(?, color),
         monthly_limit_cents = CASE WHEN ? THEN ? ELSE monthly_limit_cents END,
         is_archived = COALESCE(?, is_archived)
       WHERE id = ? AND user_id = ? RETURNING *`,
    )
    .bind(
      f.name,
      f.type,
      f.priority,
      f.icon,
      f.color,
      has(b, 'monthly_limit_cents') ? 1 : 0,
      f.monthly_limit_cents,
      f.is_archived === null ? null : f.is_archived ? 1 : 0,
      id,
      userId,
    )
    .first<Row>();
  if (!row) throw notFound('Category');
  return json({ category: mapCategory(row) });
});

/**
 * Delete a category. If expenses (or bills / wishes) use it, the caller must
 * pass ?move_to=<categoryId>; otherwise we answer 409 with the count so the
 * app can ask where to move them.
 */
route('DELETE', '/api/categories/:id', async ({ db, userId, params, url }) => {
  const id = idParam(params.id);
  await assertOwned(db, 'categories', id, userId, 'Category');
  const used = await db
    .prepare('SELECT COUNT(*) AS n FROM expenses WHERE user_id = ? AND category_id = ?')
    .bind(userId, id)
    .first<{ n: number }>();
  const count = Number(used?.n ?? 0);
  const moveRaw = url.searchParams.get('move_to');
  if (count > 0 && !moveRaw) {
    throw new HttpError(
      409,
      `${count} expense(s) use this category. Choose where to move them first.`,
      'HAS_EXPENSES',
      {
        count,
      },
    );
  }
  const stmts: D1PreparedStatement[] = [];
  if (moveRaw) {
    const moveTo = idParam(moveRaw, 'move_to');
    if (moveTo === id) throw new ValidationError('move_to', 'Pick a different category.');
    await assertOwned(db, 'categories', moveTo, userId, 'Target category');
    for (const table of ['expenses', 'fixed_bills', 'wishlist_items']) {
      stmts.push(
        db
          .prepare(`UPDATE ${table} SET category_id = ? WHERE user_id = ? AND category_id = ?`)
          .bind(moveTo, userId, id),
      );
    }
  }
  stmts.push(db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').bind(id, userId));
  await db.batch(stmts);
  return json({ ok: true, moved: count });
});

/* ---------------- income ---------------- */

route('GET', '/api/income', async ({ db, userId, url }) => {
  const from = url.searchParams.get('from') ?? '0000-01-01';
  const to = url.searchParams.get('to') ?? '9999-12-31';
  const res = await db
    .prepare(
      'SELECT * FROM income_entries WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date DESC, id DESC',
    )
    .bind(userId, from, to)
    .all<Row>();
  return json({ income: res.results.map(mapIncome) });
});

route('POST', '/api/income', async ({ db, userId, request, today }) => {
  const b = await readBody(request);
  const row = await db
    .prepare(
      `INSERT INTO income_entries (user_id, date, source, amount_cents, status, note)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
    )
    .bind(
      userId,
      date(b, 'date') ?? today,
      oneOf(b, 'source', INCOME_SOURCES) ?? 'other',
      cents(b, 'amount_cents', { required: true, allowZero: false }),
      oneOf(b, 'status', ['expected', 'received'] as const) ?? 'received',
      str(b, 'note', { max: 200 }),
    )
    .first<Row>();
  return json({ income: mapIncome(row!) }, 201);
});

route('PUT', '/api/income/:id', async ({ db, userId, request, params }) => {
  const id = idParam(params.id);
  const b = await readBody(request);
  const row = await db
    .prepare(
      `UPDATE income_entries SET date = COALESCE(?, date), source = COALESCE(?, source),
         amount_cents = COALESCE(?, amount_cents), status = COALESCE(?, status),
         note = CASE WHEN ? THEN ? ELSE note END
       WHERE id = ? AND user_id = ? RETURNING *`,
    )
    .bind(
      date(b, 'date'),
      oneOf(b, 'source', INCOME_SOURCES),
      cents(b, 'amount_cents', { allowZero: false }),
      oneOf(b, 'status', ['expected', 'received'] as const),
      has(b, 'note') ? 1 : 0,
      str(b, 'note', { max: 200 }),
      id,
      userId,
    )
    .first<Row>();
  if (!row) throw notFound('Income');
  return json({ income: mapIncome(row) });
});

route('DELETE', '/api/income/:id', async ({ db, userId, params }) => {
  const res = await db
    .prepare('DELETE FROM income_entries WHERE id = ? AND user_id = ?')
    .bind(idParam(params.id), userId)
    .run();
  if (!res.meta.changes) throw notFound('Income');
  return json({ ok: true });
});

/* ---------------- fixed bills ---------------- */

route('GET', '/api/fixed-bills', async ({ db, userId }) => {
  const res = await db
    .prepare('SELECT * FROM fixed_bills WHERE user_id = ? ORDER BY is_active DESC, due_day, id')
    .bind(userId)
    .all<Row>();
  return json({ bills: res.results.map(mapBill) });
});

async function checkCategory(c: Ctx, categoryId: number | null) {
  if (categoryId !== null) await assertOwned(c.db, 'categories', categoryId, c.userId, 'Category');
}

route('POST', '/api/fixed-bills', async (c) => {
  const b = await readBody(c.request);
  const categoryId = int(b, 'category_id', { min: 1 });
  await checkCategory(c, categoryId);
  const row = await c.db
    .prepare(
      `INSERT INTO fixed_bills (user_id, name, amount_cents, due_day, category_id)
       VALUES (?, ?, ?, ?, ?) RETURNING *`,
    )
    .bind(
      c.userId,
      str(b, 'name', { required: true, max: 60 }),
      cents(b, 'amount_cents', { required: true, allowZero: false }),
      int(b, 'due_day', { required: true, min: 1, max: 31 }),
      categoryId,
    )
    .first<Row>();
  return json({ bill: mapBill(row!) }, 201);
});

route('PUT', '/api/fixed-bills/:id', async (c) => {
  const id = idParam(c.params.id);
  const b = await readBody(c.request);
  const categoryId = int(b, 'category_id', { min: 1 });
  await checkCategory(c, categoryId);
  const active = bool(b, 'is_active');
  const row = await c.db
    .prepare(
      `UPDATE fixed_bills SET name = COALESCE(?, name), amount_cents = COALESCE(?, amount_cents),
         due_day = COALESCE(?, due_day),
         category_id = CASE WHEN ? THEN ? ELSE category_id END,
         is_active = COALESCE(?, is_active)
       WHERE id = ? AND user_id = ? RETURNING *`,
    )
    .bind(
      str(b, 'name', { max: 60 }),
      cents(b, 'amount_cents', { allowZero: false }),
      int(b, 'due_day', { min: 1, max: 31 }),
      has(b, 'category_id') ? 1 : 0,
      categoryId,
      active === null ? null : active ? 1 : 0,
      id,
      c.userId,
    )
    .first<Row>();
  if (!row) throw notFound('Bill');
  return json({ bill: mapBill(row) });
});

route('DELETE', '/api/fixed-bills/:id', async ({ db, userId, params }) => {
  // Past payments stay as expenses (fixed_bill_id becomes NULL).
  const res = await db
    .prepare('DELETE FROM fixed_bills WHERE id = ? AND user_id = ?')
    .bind(idParam(params.id), userId)
    .run();
  if (!res.meta.changes) throw notFound('Bill');
  return json({ ok: true });
});

/** Pay a bill: creates a linked expense and marks it paid for that cycle (one transaction). */
route('POST', '/api/fixed-bills/:id/pay', async ({ db, userId, request, params, today }) => {
  const id = idParam(params.id);
  const b = await readBody(request);
  const bill = await db
    .prepare(
      `SELECT b.*, c.type AS cat_type FROM fixed_bills b LEFT JOIN categories c ON c.id = b.category_id
       WHERE b.id = ? AND b.user_id = ?`,
    )
    .bind(id, userId)
    .first<Row>();
  if (!bill) throw notFound('Bill');
  const settings = await getSettings(db, userId);
  const paidOn = date(b, 'date') ?? today;
  const amount = cents(b, 'amount_cents', { allowZero: false }) ?? Number(bill.amount_cents);
  const method = oneOf(b, 'payment_method', PAYMENT_METHODS) ?? 'bank_transfer';
  const cycleStart = getCycle(paidOn, settings.salary_day, settings.cycle_mode).start;

  const existing = await db
    .prepare('SELECT 1 AS ok FROM bill_payments WHERE bill_id = ? AND cycle_start = ?')
    .bind(id, cycleStart)
    .first();
  if (existing)
    throw new HttpError(409, 'This bill is already marked paid for that cycle.', 'ALREADY_PAID');

  await db.batch([
    db
      .prepare(
        `INSERT INTO expenses (user_id, amount_cents, date, category_id, type, payment_method, note, fixed_bill_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        userId,
        amount,
        paidOn,
        bill.category_id ?? null,
        bill.cat_type === 'WANT' ? 'WANT' : 'NEED',
        method,
        String(bill.name),
        id,
      ),
    db
      .prepare(
        `INSERT INTO bill_payments (user_id, bill_id, cycle_start, amount_cents, paid_at, expense_id)
         VALUES (?, ?, ?, ?, ?, last_insert_rowid())`,
      )
      .bind(userId, id, cycleStart, amount, paidOn),
  ]);
  return json({ ok: true, cycle_start: cycleStart }, 201);
});

/** Undo a bill payment (deletes the payment and its linked expense). */
route('POST', '/api/fixed-bills/:id/unpay', async ({ db, userId, request, params }) => {
  const id = idParam(params.id);
  const b = await readBody(request);
  const cycleStart = date(b, 'cycle_start', { required: true });
  const payment = await db
    .prepare('SELECT * FROM bill_payments WHERE bill_id = ? AND user_id = ? AND cycle_start = ?')
    .bind(id, userId, cycleStart)
    .first<Row>();
  if (!payment) throw notFound('Payment');
  const stmts = [
    db.prepare('DELETE FROM bill_payments WHERE id = ? AND user_id = ?').bind(payment.id, userId),
  ];
  if (payment.expense_id) {
    stmts.push(
      db
        .prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?')
        .bind(payment.expense_id, userId),
    );
  }
  await db.batch(stmts);
  return json({ ok: true });
});

/* ---------------- savings ---------------- */

route('GET', '/api/savings', async ({ db, userId }) => {
  const [goal, moves] = await db.batch<Row>([
    db.prepare('SELECT * FROM savings_goals WHERE user_id = ?').bind(userId),
    db
      .prepare(
        'SELECT * FROM savings_moves WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 500',
      )
      .bind(userId),
  ]);
  return json({
    goal: mapGoal(goal?.results[0] ?? null),
    moves: (moves?.results ?? []).map(mapMove),
  });
});

route('PUT', '/api/savings/goal', async ({ db, userId, request }) => {
  const b = await readBody(request);
  const mode = oneOf(b, 'mode', ['amount', 'percent'] as const, { required: true });
  const amount = cents(b, 'amount_cents') ?? 0;
  const percent = int(b, 'percent', { min: 0, max: 100 }) ?? 0;
  const row = await db
    .prepare(
      `INSERT INTO savings_goals (user_id, mode, amount_cents, percent) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET mode = excluded.mode, amount_cents = excluded.amount_cents,
         percent = excluded.percent, updated_at = datetime('now')
       RETURNING *`,
    )
    .bind(userId, mode, amount, percent)
    .first<Row>();
  return json({ goal: mapGoal(row) });
});

route('POST', '/api/savings/moves', async ({ db, userId, request, today }) => {
  const b = await readBody(request);
  const amount = cents(b, 'amount_cents', {
    required: true,
    allowNegative: true,
    allowZero: false,
  });
  const row = await db
    .prepare(
      'INSERT INTO savings_moves (user_id, date, amount_cents, note) VALUES (?, ?, ?, ?) RETURNING *',
    )
    .bind(userId, date(b, 'date') ?? today, amount, str(b, 'note', { max: 200 }))
    .first<Row>();
  return json({ move: mapMove(row!) }, 201);
});

route('DELETE', '/api/savings/moves/:id', async ({ db, userId, params }) => {
  const res = await db
    .prepare('DELETE FROM savings_moves WHERE id = ? AND user_id = ?')
    .bind(idParam(params.id), userId)
    .run();
  if (!res.meta.changes) throw notFound('Savings entry');
  return json({ ok: true });
});
