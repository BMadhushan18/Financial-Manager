// Database helpers: user bootstrap, row → object mapping, ownership checks.
import { DEFAULT_CATEGORIES } from '../shared/defaults';
import type {
  Category,
  Expense,
  FixedBill,
  IncomeEntry,
  SavingsGoal,
  SavingsMove,
  Settings,
  WishlistItem,
} from '../shared/types';
import { HttpError, notFound } from './http';

type Row = Record<string, unknown>;

const userIdCache = new Map<string, number>();

/** Find the user by email, creating them (with defaults) on first visit. */
export async function getUserId(db: D1Database, email: string): Promise<number> {
  const cached = userIdCache.get(email);
  if (cached) return cached;

  let row = await db
    .prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: number }>();
  if (!row) {
    const created = await db
      .prepare('INSERT INTO users (email) VALUES (?) ON CONFLICT(email) DO NOTHING RETURNING id')
      .bind(email)
      .first<{ id: number }>();
    if (created) {
      await db.batch(defaultRowsStatements(db, created.id));
      row = created;
    } else {
      row = await db
        .prepare('SELECT id FROM users WHERE email = ?')
        .bind(email)
        .first<{ id: number }>();
    }
  }
  if (!row) throw new HttpError(500, 'Could not create your account. Please try again.');
  userIdCache.set(email, row.id);
  return row.id;
}

/** Settings, savings goal and default categories for a fresh (or reset) user. */
export function defaultRowsStatements(db: D1Database, userId: number): D1PreparedStatement[] {
  const stmts = [
    db.prepare('INSERT OR IGNORE INTO settings (user_id) VALUES (?)').bind(userId),
    db
      .prepare(
        "INSERT OR IGNORE INTO savings_goals (user_id, mode, percent) VALUES (?, 'percent', 20)",
      )
      .bind(userId),
  ];
  for (const c of DEFAULT_CATEGORIES) {
    stmts.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO categories (user_id, name, type, priority, icon, color, is_default)
           VALUES (?, ?, ?, ?, ?, ?, 1)`,
        )
        .bind(userId, c.name, c.type, c.priority, c.icon, c.color),
    );
  }
  return stmts;
}

/** Throws 404 unless the row exists and belongs to this user. */
export async function assertOwned(
  db: D1Database,
  table:
    | 'categories'
    | 'fixed_bills'
    | 'wishlist_items'
    | 'expenses'
    | 'income_entries'
    | 'savings_moves',
  id: number,
  userId: number,
  what = 'Item',
): Promise<void> {
  const row = await db
    .prepare(`SELECT 1 AS ok FROM ${table} WHERE id = ? AND user_id = ?`)
    .bind(id, userId)
    .first();
  if (!row) throw notFound(what);
}

/* ---------------- row mappers ---------------- */

const n = (v: unknown): number => Number(v ?? 0);
const nOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const sOrNull = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

export function mapSettings(r: Row): Settings {
  return {
    salary_day: n(r.salary_day),
    cycle_mode: r.cycle_mode === 'calendar' ? 'calendar' : 'salary',
    currency: String(r.currency),
    salary_cents: n(r.salary_cents),
    split_needs: n(r.split_needs),
    split_wants: n(r.split_wants),
    split_savings: n(r.split_savings),
    warnings_enabled: n(r.warnings_enabled) === 1,
    big_want_percent: n(r.big_want_percent),
    cooling_days: n(r.cooling_days),
    emergency_months: n(r.emergency_months),
    emergency_target_cents: nOrNull(r.emergency_target_cents),
    onboarded: n(r.onboarded) === 1,
  };
}

export function mapCategory(r: Row): Category {
  return {
    id: n(r.id),
    name: String(r.name),
    type: r.type as Category['type'],
    priority: r.priority as Category['priority'],
    icon: String(r.icon),
    color: String(r.color),
    monthly_limit_cents: nOrNull(r.monthly_limit_cents),
    is_default: n(r.is_default) === 1,
    is_archived: n(r.is_archived) === 1,
  };
}

export function mapIncome(r: Row): IncomeEntry {
  return {
    id: n(r.id),
    date: String(r.date),
    source: r.source as IncomeEntry['source'],
    amount_cents: n(r.amount_cents),
    status: r.status as IncomeEntry['status'],
    note: sOrNull(r.note),
  };
}

export function mapBill(r: Row): FixedBill {
  return {
    id: n(r.id),
    name: String(r.name),
    amount_cents: n(r.amount_cents),
    due_day: n(r.due_day),
    category_id: nOrNull(r.category_id),
    is_active: n(r.is_active) === 1,
  };
}

export function mapGoal(r: Row | null): SavingsGoal {
  if (!r) return { mode: 'percent', amount_cents: 0, percent: 20 };
  return {
    mode: r.mode === 'amount' ? 'amount' : 'percent',
    amount_cents: n(r.amount_cents),
    percent: n(r.percent),
  };
}

export function mapMove(r: Row): SavingsMove {
  return {
    id: n(r.id),
    date: String(r.date),
    amount_cents: n(r.amount_cents),
    note: sOrNull(r.note),
  };
}

export function mapWish(r: Row): WishlistItem {
  return {
    id: n(r.id),
    name: String(r.name),
    category_id: nOrNull(r.category_id),
    type: r.type as WishlistItem['type'],
    priority: r.priority as WishlistItem['priority'],
    urgency: r.urgency as WishlistItem['urgency'],
    estimated_cents: nOrNull(r.estimated_cents),
    quantity: n(r.quantity) || 1,
    link: sOrNull(r.link),
    note: sOrNull(r.note),
    status: r.status as WishlistItem['status'],
    prev_status: (r.prev_status ?? null) as WishlistItem['prev_status'],
    added_at: String(r.added_at),
    target_cycle: sOrNull(r.target_cycle),
    reminder_date: sOrNull(r.reminder_date),
    bought_at: sOrNull(r.bought_at),
    actual_cents: nOrNull(r.actual_cents),
    payment_method: (r.payment_method ?? null) as WishlistItem['payment_method'],
    dropped_at: sOrNull(r.dropped_at),
    repeat_of: nOrNull(r.repeat_of),
    expense_id: nOrNull(r.expense_id),
  };
}

export function mapExpense(r: Row): Expense {
  const e: Expense = {
    id: n(r.id),
    amount_cents: n(r.amount_cents),
    date: String(r.date),
    category_id: nOrNull(r.category_id),
    type: r.type as Expense['type'],
    payment_method: r.payment_method as Expense['payment_method'],
    note: sOrNull(r.note),
    wishlist_item_id: nOrNull(r.wishlist_item_id),
    fixed_bill_id: nOrNull(r.fixed_bill_id),
    refund_of: nOrNull(r.refund_of),
    created_at: String(r.created_at),
  };
  if (r.refunded_cents !== undefined) e.refunded_cents = n(r.refunded_cents);
  return e;
}

/** SELECT used everywhere a wishlist item is returned (adds the linked expense id). */
export const WISH_SELECT = `SELECT w.*, (SELECT e.id FROM expenses e WHERE e.wishlist_item_id = w.id) AS expense_id
  FROM wishlist_items w`;

export async function getWish(db: D1Database, id: number, userId: number): Promise<WishlistItem> {
  const row = await db
    .prepare(`${WISH_SELECT} WHERE w.id = ? AND w.user_id = ?`)
    .bind(id, userId)
    .first<Row>();
  if (!row) throw notFound('Wishlist item');
  return mapWish(row);
}

export async function getSettings(db: D1Database, userId: number): Promise<Settings> {
  const row = await db
    .prepare('SELECT * FROM settings WHERE user_id = ?')
    .bind(userId)
    .first<Row>();
  if (!row) throw new HttpError(500, 'Your settings are missing. Please reload.');
  return mapSettings(row);
}
