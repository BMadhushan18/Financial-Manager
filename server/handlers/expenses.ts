// Expenses: list / add / edit / delete / refund.
import { buildRefundExpense, getCycle, undoStatus, validateRefund } from '../../shared/finance';
import { ENTRY_TYPES, PAYMENT_METHODS } from '../../shared/types';
import { cents, date, has, idParam, int, oneOf, str } from '../../shared/validation';
import { getSettings, getWish, mapExpense } from '../db';
import { HttpError, json, notFound, readBody } from '../http';
import { route, type Ctx } from '../router';

type Row = Record<string, unknown>;

const EXPENSE_SELECT = `SELECT e.*,
  (SELECT COALESCE(-SUM(r.amount_cents), 0) FROM expenses r WHERE r.refund_of = e.id) AS refunded_cents
  FROM expenses e`;

async function loadExpense(c: Ctx, id: number) {
  const row = await c.db
    .prepare(`${EXPENSE_SELECT} WHERE e.id = ? AND e.user_id = ?`)
    .bind(id, c.userId)
    .first<Row>();
  if (!row) throw notFound('Expense');
  return mapExpense(row);
}

async function categoryType(c: Ctx, categoryId: number | null) {
  if (categoryId === null) return null;
  const row = await c.db
    .prepare('SELECT type FROM categories WHERE id = ? AND user_id = ?')
    .bind(categoryId, c.userId)
    .first<{ type: 'NEED' | 'WANT' }>();
  if (!row) throw notFound('Category');
  return row.type;
}

route('GET', '/api/expenses', async ({ db, userId, url }) => {
  const p = url.searchParams;
  const from = p.get('from') ?? '0000-01-01';
  const to = p.get('to') ?? '9999-12-31';
  const category = p.get('category_id');
  const type = p.get('type');
  const method = p.get('payment_method');
  const res = await db
    .prepare(
      `${EXPENSE_SELECT}
       WHERE e.user_id = ? AND e.date BETWEEN ? AND ?
         AND (? IS NULL OR e.category_id = ?)
         AND (? IS NULL OR e.type = ?)
         AND (? IS NULL OR e.payment_method = ?)
       ORDER BY e.date DESC, e.id DESC LIMIT 2000`,
    )
    .bind(
      userId,
      from,
      to,
      category ? Number(category) : null,
      category ? Number(category) : null,
      type && (ENTRY_TYPES as string[]).includes(type) ? type : null,
      type && (ENTRY_TYPES as string[]).includes(type) ? type : null,
      method && (PAYMENT_METHODS as string[]).includes(method) ? method : null,
      method && (PAYMENT_METHODS as string[]).includes(method) ? method : null,
    )
    .all<Row>();
  return json({ expenses: res.results.map(mapExpense) });
});

route('POST', '/api/expenses', async (c) => {
  const b = await readBody(c.request);
  const categoryId = int(b, 'category_id', { min: 1 });
  const catType = await categoryType(c, categoryId);
  const row = await c.db
    .prepare(
      `INSERT INTO expenses (user_id, amount_cents, date, category_id, type, payment_method, note)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *, 0 AS refunded_cents`,
    )
    .bind(
      c.userId,
      cents(b, 'amount_cents', { required: true, allowZero: false }),
      date(b, 'date') ?? c.today,
      categoryId,
      oneOf(b, 'type', ENTRY_TYPES) ?? catType ?? 'WANT',
      oneOf(b, 'payment_method', PAYMENT_METHODS) ?? 'cash',
      str(b, 'note', { max: 200 }),
    )
    .first<Row>();
  return json({ expense: mapExpense(row!) }, 201);
});

/**
 * Edit an expense. A wishlist-linked expense keeps its item in sync
 * (price, date, payment method, category). A bill payment keeps its
 * bill_payments row in sync.
 */
route('PUT', '/api/expenses/:id', async (c) => {
  const id = idParam(c.params.id);
  const e = await loadExpense(c, id);
  const b = await readBody(c.request);

  const categoryId = has(b, 'category_id') ? int(b, 'category_id', { min: 1 }) : e.category_id;
  const catType = categoryId !== e.category_id ? await categoryType(c, categoryId) : null;
  let amount = e.amount_cents;
  if (has(b, 'amount_cents')) {
    const raw = cents(b, 'amount_cents', { required: true, allowZero: false })!;
    if (e.refund_of !== null) {
      // Refund amounts are entered positive and stored negative.
      const original = await loadExpense(c, e.refund_of);
      const others = (original.refunded_cents ?? 0) - -e.amount_cents;
      const problem = validateRefund(original, others, raw);
      if (problem) throw new HttpError(400, problem, 'VALIDATION');
      amount = -raw;
    } else {
      if ((e.refunded_cents ?? 0) > raw) {
        throw new HttpError(
          400,
          'The amount cannot be less than what was already refunded.',
          'VALIDATION',
        );
      }
      amount = raw;
    }
  }
  const next = {
    amount,
    date: date(b, 'date') ?? e.date,
    category_id: categoryId,
    type: oneOf(b, 'type', ENTRY_TYPES) ?? catType ?? e.type,
    payment_method: oneOf(b, 'payment_method', PAYMENT_METHODS) ?? e.payment_method,
    note: has(b, 'note') ? str(b, 'note', { max: 200 }) : e.note,
  };

  const stmts: D1PreparedStatement[] = [
    c.db
      .prepare(
        `UPDATE expenses SET amount_cents = ?, date = ?, category_id = ?, type = ?, payment_method = ?, note = ?,
           updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
      )
      .bind(
        next.amount,
        next.date,
        next.category_id,
        next.type,
        next.payment_method,
        next.note,
        id,
        c.userId,
      ),
  ];
  if (e.wishlist_item_id !== null) {
    stmts.push(
      c.db
        .prepare(
          `UPDATE wishlist_items SET actual_cents = ?, bought_at = ?, payment_method = ?, category_id = ?, type = ?,
             updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
        )
        .bind(
          next.amount,
          next.date,
          next.payment_method,
          next.category_id,
          next.type,
          e.wishlist_item_id,
          c.userId,
        ),
    );
  }
  if (e.fixed_bill_id !== null) {
    const s = await getSettings(c.db, c.userId);
    stmts.push(
      c.db
        .prepare(
          'UPDATE bill_payments SET amount_cents = ?, paid_at = ?, cycle_start = ? WHERE expense_id = ? AND user_id = ?',
        )
        .bind(
          next.amount,
          next.date,
          getCycle(next.date, s.salary_day, s.cycle_mode).start,
          id,
          c.userId,
        ),
    );
  }
  await c.db.batch(stmts);
  return json({ expense: await loadExpense(c, id) });
});

/**
 * Delete an expense. Refunds of it go too (FK cascade), a bill payment
 * becomes unpaid, and a wishlist item returns to its previous status.
 */
route('DELETE', '/api/expenses/:id', async (c) => {
  const id = idParam(c.params.id);
  const e = await loadExpense(c, id);
  const stmts: D1PreparedStatement[] = [
    c.db.prepare('DELETE FROM expenses WHERE refund_of = ? AND user_id = ?').bind(id, c.userId),
    c.db
      .prepare('DELETE FROM bill_payments WHERE expense_id = ? AND user_id = ?')
      .bind(id, c.userId),
    c.db.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?').bind(id, c.userId),
  ];
  if (e.wishlist_item_id !== null) {
    const item = await getWish(c.db, e.wishlist_item_id, c.userId);
    const back = undoStatus(item);
    if (back) {
      stmts.push(
        c.db
          .prepare(
            `UPDATE wishlist_items SET status = ?, prev_status = NULL, bought_at = NULL, actual_cents = NULL,
               payment_method = NULL, target_cycle = CASE WHEN ? = 'PLANNED' THEN target_cycle ELSE NULL END,
               updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
          )
          .bind(back, back, item.id, c.userId),
      );
    }
  }
  await c.db.batch(stmts);
  return json({ ok: true, wishlist_item_id: e.wishlist_item_id });
});

/** Refund = a negative expense linked to the original. */
route('POST', '/api/expenses/:id/refund', async (c) => {
  const id = idParam(c.params.id);
  const original = await loadExpense(c, id);
  const b = await readBody(c.request);
  const amount = cents(b, 'amount_cents', { required: true, allowZero: false })!;
  const settings = await getSettings(c.db, c.userId);
  const problem = validateRefund(original, original.refunded_cents ?? 0, amount, settings.currency);
  if (problem) throw new HttpError(400, problem, 'VALIDATION');
  const r = buildRefundExpense(
    original,
    amount,
    date(b, 'date') ?? c.today,
    str(b, 'note', { max: 200 }),
  );
  const row = await c.db
    .prepare(
      `INSERT INTO expenses (user_id, amount_cents, date, category_id, type, payment_method, note, refund_of)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *, 0 AS refunded_cents`,
    )
    .bind(
      c.userId,
      r.amount_cents,
      r.date,
      r.category_id,
      r.type,
      r.payment_method,
      r.note,
      r.refund_of,
    )
    .first<Row>();
  return json({ expense: mapExpense(row!) }, 201);
});
