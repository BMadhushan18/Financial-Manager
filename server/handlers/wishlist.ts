// Lifetime wishlist: CRUD + plan / bought / drop / undo / re-add.
import {
  buildBoughtExpense,
  buildRepeatWish,
  canMarkBought,
  itemTotalCents,
  planFits,
  suggestType,
  undoStatus,
} from '../../shared/finance';
import {
  ENTRY_TYPES,
  PAYMENT_METHODS,
  PRIORITIES,
  URGENCIES,
  WISH_STATUSES,
  type WishlistItem,
} from '../../shared/types';
import {
  cents,
  date,
  has,
  idParam,
  int,
  oneOf,
  str,
  url,
  type Body,
} from '../../shared/validation';
import { loadCycleContext } from '../context';
import { assertOwned, getWish, mapCategory, mapWish, WISH_SELECT } from '../db';
import { HttpError, json, readBody } from '../http';
import { route, type Ctx } from '../router';

type Row = Record<string, unknown>;

route('GET', '/api/wishlist', async ({ db, userId, url: u }) => {
  const status = u.searchParams.get('status');
  const filter = status && (WISH_STATUSES as string[]).includes(status) ? status : null;
  const res = await db
    .prepare(
      `${WISH_SELECT} WHERE w.user_id = ? AND (? IS NULL OR w.status = ?) ORDER BY w.added_at DESC, w.id DESC`,
    )
    .bind(userId, filter, filter)
    .all<Row>();
  return json({ items: res.results.map(mapWish) });
});

route('GET', '/api/wishlist/:id', async ({ db, userId, params }) => {
  const id = idParam(params.id);
  const item = await getWish(db, id, userId);
  const history = await db
    .prepare(
      'SELECT id, price_cents, changed_at FROM wishlist_price_history WHERE item_id = ? AND user_id = ? ORDER BY changed_at, id',
    )
    .bind(id, userId)
    .all<{ id: number; price_cents: number; changed_at: string }>();
  return json({ item, price_history: history.results });
});

async function categoryFor(c: Ctx, categoryId: number | null) {
  if (categoryId === null) return null;
  const row = await c.db
    .prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?')
    .bind(categoryId, c.userId)
    .first<Row>();
  if (!row) throw new HttpError(404, 'Category not found.', 'NOT_FOUND');
  return mapCategory(row);
}

route('POST', '/api/wishlist', async (c) => {
  const b = await readBody(c.request);
  const name = str(b, 'name', { required: true, max: 120 })!;
  const categoryId = int(b, 'category_id', { min: 1 });
  const category = await categoryFor(c, categoryId);
  const suggestion = suggestType(name, category);
  const type = oneOf(b, 'type', ENTRY_TYPES) ?? suggestion.type;
  const estimated = cents(b, 'estimated_cents');

  const row = await c.db
    .prepare(
      `INSERT INTO wishlist_items (user_id, name, category_id, type, priority, urgency, estimated_cents,
         quantity, link, note, added_at, reminder_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *, NULL AS expense_id`,
    )
    .bind(
      c.userId,
      name,
      categoryId,
      type,
      oneOf(b, 'priority', PRIORITIES) ?? 'MEDIUM',
      oneOf(b, 'urgency', URGENCIES) ?? 'SOMEDAY',
      estimated,
      int(b, 'quantity', { min: 1, max: 999 }) ?? 1,
      url(b, 'link'),
      str(b, 'note', { max: 500 }),
      c.today,
      date(b, 'reminder_date'),
    )
    .first<Row>();
  const item = mapWish(row!);
  if (estimated !== null) {
    await c.db
      .prepare(
        'INSERT INTO wishlist_price_history (user_id, item_id, price_cents, changed_at) VALUES (?, ?, ?, ?)',
      )
      .bind(c.userId, item.id, estimated, c.today)
      .run();
  }
  return json({ item, suggestion }, 201);
});

function merged(item: WishlistItem, b: Body): WishlistItem {
  const pick = <T>(key: string, read: () => T | null, current: T): T | null =>
    has(b, key) ? read() : current;
  return {
    ...item,
    name: has(b, 'name') ? str(b, 'name', { required: true, max: 120 })! : item.name,
    category_id: pick('category_id', () => int(b, 'category_id', { min: 1 }), item.category_id),
    type: oneOf(b, 'type', ENTRY_TYPES) ?? item.type,
    priority: oneOf(b, 'priority', PRIORITIES) ?? item.priority,
    urgency: oneOf(b, 'urgency', URGENCIES) ?? item.urgency,
    estimated_cents: pick(
      'estimated_cents',
      () => cents(b, 'estimated_cents'),
      item.estimated_cents,
    ),
    quantity: int(b, 'quantity', { min: 1, max: 999 }) ?? item.quantity,
    link: pick('link', () => url(b, 'link'), item.link),
    note: pick('note', () => str(b, 'note', { max: 500 }), item.note),
    reminder_date: pick('reminder_date', () => date(b, 'reminder_date'), item.reminder_date),
  };
}

route('PUT', '/api/wishlist/:id', async (c) => {
  const id = idParam(c.params.id);
  const item = await getWish(c.db, id, c.userId);
  const next = merged(item, await readBody(c.request));
  if (next.category_id !== item.category_id) await categoryFor(c, next.category_id);

  const stmts = [
    c.db
      .prepare(
        `UPDATE wishlist_items SET name = ?, category_id = ?, type = ?, priority = ?, urgency = ?,
           estimated_cents = ?, quantity = ?, link = ?, note = ?, reminder_date = ?, updated_at = datetime('now')
         WHERE id = ? AND user_id = ?`,
      )
      .bind(
        next.name,
        next.category_id,
        next.type,
        next.priority,
        next.urgency,
        next.estimated_cents,
        next.quantity,
        next.link,
        next.note,
        next.reminder_date,
        id,
        c.userId,
      ),
  ];
  if (next.estimated_cents !== null && next.estimated_cents !== item.estimated_cents) {
    stmts.push(
      c.db
        .prepare(
          'INSERT INTO wishlist_price_history (user_id, item_id, price_cents, changed_at) VALUES (?, ?, ?, ?)',
        )
        .bind(c.userId, id, next.estimated_cents, c.today),
    );
  }
  // Keep a bought item's linked expense in the same category/type.
  if (
    item.status === 'BOUGHT' &&
    (next.category_id !== item.category_id || next.type !== item.type)
  ) {
    stmts.push(
      c.db
        .prepare(
          "UPDATE expenses SET category_id = ?, type = ?, updated_at = datetime('now') WHERE wishlist_item_id = ? AND user_id = ?",
        )
        .bind(next.category_id, next.type, id, c.userId),
    );
  }
  await c.db.batch(stmts);
  return json({ item: await getWish(c.db, id, c.userId) });
});

route('DELETE', '/api/wishlist/:id', async ({ db, userId, params }) => {
  const id = idParam(params.id);
  await assertOwned(db, 'wishlist_items', id, userId, 'Wishlist item');
  // A bought item's expense stays (the money was spent); it just loses the link.
  await db
    .prepare('DELETE FROM wishlist_items WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .run();
  return json({ ok: true });
});

/** Move into this (or next) cycle. Its price is then reserved in safe-to-spend. */
route('POST', '/api/wishlist/:id/plan', async (c) => {
  const id = idParam(c.params.id);
  const b = await readBody(c.request);
  const which = oneOf(b, 'cycle', ['current', 'next'] as const) ?? 'current';
  const force = b.force === true;
  const item = await getWish(c.db, id, c.userId);
  if (item.status === 'BOUGHT' || item.status === 'DROPPED') {
    throw new HttpError(
      409,
      'Only ideas can be planned. Undo first if you changed your mind.',
      'BAD_STATUS',
    );
  }
  const ctx = await loadCycleContext(c.db, c.userId, c.today);
  const target = which === 'next' ? ctx.next.start : ctx.cycle.start;
  const price = itemTotalCents(item);
  const alreadyReserved =
    item.status === 'PLANNED' && item.target_cycle === ctx.cycle.start ? price : 0;
  const fit = planFits(price, ctx.safe + alreadyReserved);
  if (which === 'current' && !fit.fits && !force) {
    throw new HttpError(
      409,
      'This does not fit in your safe-to-spend this cycle.',
      'DOES_NOT_FIT',
      {
        missing_cents: fit.missingCents,
      },
    );
  }
  await c.db
    .prepare(
      `UPDATE wishlist_items SET status = 'PLANNED', prev_status = status, target_cycle = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
    )
    .bind(target, id, c.userId)
    .run();
  return json({
    item: await getWish(c.db, id, c.userId),
    fits: fit.fits,
    missing_cents: fit.missingCents,
  });
});

route('POST', '/api/wishlist/:id/unplan', async ({ db, userId, params }) => {
  const id = idParam(params.id);
  const res = await db
    .prepare(
      `UPDATE wishlist_items SET status = 'IDEA', prev_status = 'PLANNED', target_cycle = NULL, updated_at = datetime('now')
       WHERE id = ? AND user_id = ? AND status = 'PLANNED'`,
    )
    .bind(id, userId)
    .run();
  if (!res.meta.changes) throw new HttpError(409, 'This item is not planned.', 'BAD_STATUS');
  return json({ item: await getWish(db, id, userId) });
});

/** Mark bought: update item + create ONE linked expense, in one transaction. */
route('POST', '/api/wishlist/:id/bought', async (c) => {
  const id = idParam(c.params.id);
  const b = await readBody(c.request);
  const item = await getWish(c.db, id, c.userId);
  const problem = canMarkBought(item);
  if (problem) throw new HttpError(409, problem, 'BAD_STATUS');

  const actual = cents(b, 'actual_cents', { allowZero: false }) ?? itemTotalCents(item);
  if (actual <= 0) throw new HttpError(400, 'Please enter the price you paid.', 'VALIDATION');
  const expense = buildBoughtExpense(item, {
    actual_cents: actual,
    date: date(b, 'date') ?? c.today,
    payment_method: oneOf(b, 'payment_method', PAYMENT_METHODS) ?? 'cash',
  });

  await c.db.batch([
    c.db
      .prepare(
        `INSERT INTO expenses (user_id, amount_cents, date, category_id, type, payment_method, note, wishlist_item_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        c.userId,
        expense.amount_cents,
        expense.date,
        expense.category_id,
        expense.type,
        expense.payment_method,
        expense.note,
        id,
      ),
    c.db
      .prepare(
        `UPDATE wishlist_items SET status = 'BOUGHT', prev_status = ?, bought_at = ?, actual_cents = ?,
           payment_method = ?, reminder_date = NULL, updated_at = datetime('now')
         WHERE id = ? AND user_id = ?`,
      )
      .bind(item.status, expense.date, actual, expense.payment_method, id, c.userId),
  ]);
  return json({ item: await getWish(c.db, id, c.userId) }, 201);
});

route('POST', '/api/wishlist/:id/drop', async ({ db, userId, params, today }) => {
  const id = idParam(params.id);
  const item = await getWish(db, id, userId);
  if (item.status === 'BOUGHT')
    throw new HttpError(409, 'This was bought. Undo the purchase first.', 'BAD_STATUS');
  if (item.status === 'DROPPED') return json({ item });
  await db
    .prepare(
      `UPDATE wishlist_items SET status = 'DROPPED', prev_status = status, dropped_at = ?, reminder_date = NULL,
         updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
    )
    .bind(today, id, userId)
    .run();
  return json({ item: await getWish(db, id, userId) });
});

/** Undo BOUGHT (deletes the linked expense) or DROPPED → previous status. */
route('POST', '/api/wishlist/:id/undo', async ({ db, userId, params }) => {
  const id = idParam(params.id);
  const item = await getWish(db, id, userId);
  const back = undoStatus(item);
  if (!back) throw new HttpError(409, 'There is nothing to undo for this item.', 'BAD_STATUS');

  const stmts: D1PreparedStatement[] = [];
  if (item.status === 'BOUGHT') {
    const refunds = await db
      .prepare(
        `SELECT COUNT(*) AS n FROM expenses r JOIN expenses e ON r.refund_of = e.id
         WHERE e.wishlist_item_id = ? AND e.user_id = ?`,
      )
      .bind(id, userId)
      .first<{ n: number }>();
    if (Number(refunds?.n ?? 0) > 0) {
      throw new HttpError(
        409,
        'This purchase has a refund. Delete the refund first, then undo.',
        'HAS_REFUND',
      );
    }
    stmts.push(
      db
        .prepare('DELETE FROM expenses WHERE wishlist_item_id = ? AND user_id = ?')
        .bind(id, userId),
    );
  }
  stmts.push(
    db
      .prepare(
        `UPDATE wishlist_items SET status = ?, prev_status = NULL, bought_at = NULL, actual_cents = NULL,
           payment_method = NULL, dropped_at = NULL,
           target_cycle = CASE WHEN ? = 'PLANNED' THEN target_cycle ELSE NULL END,
           updated_at = datetime('now')
         WHERE id = ? AND user_id = ?`,
      )
      .bind(back, back, id, userId),
  );
  await db.batch(stmts);
  return json({ item: await getWish(db, id, userId) });
});

/** Recurring wish: add a fresh copy of a bought item with one tap. */
route('POST', '/api/wishlist/:id/readd', async ({ db, userId, params, today }) => {
  const id = idParam(params.id);
  const item = await getWish(db, id, userId);
  const copy = buildRepeatWish(item, today);
  const row = await db
    .prepare(
      `INSERT INTO wishlist_items (user_id, name, category_id, type, priority, urgency, estimated_cents,
         quantity, link, note, added_at, repeat_of)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *, NULL AS expense_id`,
    )
    .bind(
      userId,
      copy.name,
      copy.category_id,
      copy.type,
      copy.priority,
      copy.urgency,
      copy.estimated_cents,
      copy.quantity,
      copy.link,
      copy.note,
      copy.added_at,
      copy.repeat_of,
    )
    .first<Row>();
  return json({ item: mapWish(row!) }, 201);
});
