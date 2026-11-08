// Loads everything about the current pay cycle in two D1 batches and runs
// the pure finance rules over it. Used by /cycle/current, /purchase-check,
// wishlist planning and reports.
import {
  billDueDate,
  billsCommitted,
  budgetProgress,
  computeSafeToSpend,
  daysLeftInCycle,
  emergencyTarget,
  getCycle,
  itemTotalCents,
  nextCycle,
  percentOf,
  previousCycle,
  safePerDay,
  savingsGoalCents,
} from '../shared/finance';
import type {
  BillInCycle,
  BudgetProgress,
  CycleRange,
  CycleSummary,
  CycleTotals,
  IncomeEntry,
  SavingsGoal,
  SavingsMove,
  Settings,
  WishlistItem,
} from '../shared/types';
import { mapBill, mapGoal, mapIncome, mapMove, mapSettings, mapWish } from './db';

type Row = Record<string, unknown>;

export interface CycleContext {
  today: string;
  settings: Settings;
  goal: SavingsGoal;
  cycle: CycleRange;
  next: CycleRange;
  previous: CycleRange;
  daysLeft: number;
  incomes: IncomeEntry[];
  bills: BillInCycle[];
  activeWishes: WishlistItem[];
  planned: WishlistItem[];
  stalePlanned: WishlistItem[];
  moves: SavingsMove[];
  savingsBalance: number;
  totals: CycleTotals;
  safe: number;
  perDay: number;
  progress: BudgetProgress;
  emergencyTargetCents: number;
  previousClosed: boolean;
}

export async function loadCycleContext(
  db: D1Database,
  userId: number,
  today: string,
  opts: { autoSalary?: boolean } = {},
): Promise<CycleContext> {
  const [settingsRes, goalRes] = await db.batch<Row>([
    db.prepare('SELECT * FROM settings WHERE user_id = ?').bind(userId),
    db.prepare('SELECT * FROM savings_goals WHERE user_id = ?').bind(userId),
  ]);
  const settingsRow = settingsRes?.results[0];
  if (!settingsRow) throw new Error('Settings row missing');
  const settings = mapSettings(settingsRow);
  const goal = mapGoal(goalRes?.results[0] ?? null);
  const cycle = getCycle(today, settings.salary_day, settings.cycle_mode);
  const next = nextCycle(cycle, settings.salary_day, settings.cycle_mode);
  const previous = previousCycle(cycle, settings.salary_day, settings.cycle_mode);

  // Each new cycle gets one "expected" salary entry automatically (once).
  if (
    opts.autoSalary &&
    settings.salary_cents > 0 &&
    settingsRow.last_salary_cycle !== cycle.start
  ) {
    await db.batch([
      db
        .prepare(
          `INSERT INTO income_entries (user_id, date, source, amount_cents, status, note)
           SELECT ?, ?, 'salary', ?, 'expected', 'Monthly salary'
           WHERE NOT EXISTS (SELECT 1 FROM income_entries
                             WHERE user_id = ? AND source = 'salary' AND date BETWEEN ? AND ?)`,
        )
        .bind(
          userId,
          billDueDate(cycle, settings.salary_day),
          settings.salary_cents,
          userId,
          cycle.start,
          cycle.end,
        ),
      db
        .prepare('UPDATE settings SET last_salary_cycle = ? WHERE user_id = ?')
        .bind(cycle.start, userId),
    ]);
  }

  const [incomeRes, billsRes, expenseRes, movesRes, balanceRes, wishesRes, closedRes] =
    await db.batch<Row>([
      db
        .prepare(
          'SELECT * FROM income_entries WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date, id',
        )
        .bind(userId, cycle.start, cycle.end),
      db
        .prepare(
          `SELECT b.*, c.type AS cat_type, p.id AS payment_id, p.amount_cents AS paid_cents,
                p.paid_at, p.expense_id
         FROM fixed_bills b
         LEFT JOIN categories c ON c.id = b.category_id
         LEFT JOIN bill_payments p ON p.bill_id = b.id AND p.cycle_start = ?
         WHERE b.user_id = ? AND (b.is_active = 1 OR p.id IS NOT NULL)
         ORDER BY b.due_day, b.id`,
        )
        .bind(cycle.start, userId),
      db
        .prepare(
          `SELECT type, CASE WHEN fixed_bill_id IS NULL THEN 0 ELSE 1 END AS is_bill,
                COALESCE(SUM(amount_cents), 0) AS total
         FROM expenses WHERE user_id = ? AND date BETWEEN ? AND ?
         GROUP BY type, is_bill`,
        )
        .bind(userId, cycle.start, cycle.end),
      db
        .prepare(
          'SELECT * FROM savings_moves WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date, id',
        )
        .bind(userId, cycle.start, cycle.end),
      db
        .prepare(
          'SELECT COALESCE(SUM(amount_cents), 0) AS total FROM savings_moves WHERE user_id = ?',
        )
        .bind(userId),
      db
        .prepare(
          `SELECT w.*, NULL AS expense_id FROM wishlist_items w
         WHERE w.user_id = ? AND w.status IN ('IDEA', 'PLANNED')`,
        )
        .bind(userId),
      db
        .prepare('SELECT 1 AS ok FROM cycles WHERE user_id = ? AND start_date = ?')
        .bind(userId, previous.start),
    ]);

  const incomes = (incomeRes?.results ?? []).map(mapIncome);
  const bills: BillInCycle[] = (billsRes?.results ?? []).map((r) => {
    const base = mapBill(r);
    const paid = r.payment_id !== null && r.payment_id !== undefined;
    return {
      ...base,
      type: r.cat_type === 'WANT' ? 'WANT' : 'NEED',
      due_date: billDueDate(cycle, base.due_day),
      is_paid: paid,
      paid_cents: paid ? Number(r.paid_cents) : null,
      paid_at: paid ? String(r.paid_at) : null,
      payment_id: paid ? Number(r.payment_id) : null,
      expense_id: paid && r.expense_id !== null ? Number(r.expense_id) : null,
    };
  });
  const moves = (movesRes?.results ?? []).map(mapMove);
  const savingsBalance = Number(balanceRes?.results[0]?.total ?? 0);
  const activeWishes = (wishesRes?.results ?? []).map(mapWish);

  let needsSpent = 0;
  let wantsSpent = 0;
  let otherExpenses = 0;
  for (const r of expenseRes?.results ?? []) {
    const total = Number(r.total);
    if (r.type === 'NEED') needsSpent += total;
    else wantsSpent += total;
    if (Number(r.is_bill) === 0) otherExpenses += total;
  }

  const incomeReceived = incomes
    .filter((i) => i.status === 'received')
    .reduce((s, i) => s + i.amount_cents, 0);
  const incomeExpected = incomes
    .filter((i) => i.status === 'expected')
    .reduce((s, i) => s + i.amount_cents, 0);
  const income = incomeReceived + incomeExpected;
  const committed = billsCommitted(bills);
  const unpaidNeedBills = bills
    .filter((b) => !b.is_paid && b.type === 'NEED')
    .reduce((s, b) => s + b.amount_cents, 0);
  const goalCents = savingsGoalCents(goal, income);
  const moved = moves.reduce((s, m) => s + m.amount_cents, 0);
  const planned = activeWishes.filter(
    (w) => w.status === 'PLANNED' && w.target_cycle === cycle.start,
  );
  const stalePlanned = activeWishes.filter(
    (w) => w.status === 'PLANNED' && (w.target_cycle === null || w.target_cycle < cycle.start),
  );
  const reserved = planned.reduce((s, w) => s + itemTotalCents(w), 0);

  const safe = computeSafeToSpend({
    incomeCents: income,
    unpaidBillsCents: committed.unpaid,
    paidBillsCents: committed.paid,
    savingsGoalCents: goalCents,
    savingsMovedCents: moved,
    reservedCents: reserved,
    otherExpensesCents: otherExpenses,
  });
  const daysLeft = daysLeftInCycle(today, cycle);
  const progress = budgetProgress(
    income,
    { needs: settings.split_needs, wants: settings.split_wants, savings: settings.split_savings },
    { needs: needsSpent, wants: wantsSpent, savings: moved },
  );

  const baseIncome = income || settings.salary_cents;
  const needBills = bills.filter((b) => b.type === 'NEED').reduce((s, b) => s + b.amount_cents, 0);
  const monthlyNeeds = Math.max(percentOf(baseIncome, settings.split_needs), needBills);
  const emergencyTargetCents =
    settings.emergency_target_cents ?? emergencyTarget(monthlyNeeds, settings.emergency_months);

  return {
    today,
    settings,
    goal,
    cycle,
    next,
    previous,
    daysLeft,
    incomes,
    bills,
    activeWishes,
    planned,
    stalePlanned,
    moves,
    savingsBalance,
    totals: {
      income_cents: income,
      income_received_cents: incomeReceived,
      income_expected_cents: incomeExpected,
      bills_committed_cents: committed.total,
      bills_paid_cents: committed.paid,
      bills_unpaid_cents: committed.unpaid,
      unpaid_need_bills_cents: unpaidNeedBills,
      savings_goal_cents: goalCents,
      savings_moved_cents: moved,
      reserved_cents: reserved,
      other_expenses_cents: otherExpenses,
      needs_spent_cents: needsSpent,
      wants_spent_cents: wantsSpent,
    },
    safe,
    perDay: safePerDay(safe, daysLeft),
    progress,
    emergencyTargetCents,
    previousClosed: Boolean(closedRes?.results[0]),
  };
}

/** Income / spent / needs / wants / saved for each range (3 queries total). */
export async function cycleSummaries(
  db: D1Database,
  userId: number,
  ranges: CycleRange[],
): Promise<CycleSummary[]> {
  if (ranges.length === 0) return [];
  const from = ranges[0]!.start;
  const to = ranges[ranges.length - 1]!.end;
  const [incomeRes, expenseRes, savingsRes] = await db.batch<Row>([
    db
      .prepare(
        `SELECT date, SUM(amount_cents) AS total FROM income_entries
         WHERE user_id = ? AND date BETWEEN ? AND ? GROUP BY date`,
      )
      .bind(userId, from, to),
    db
      .prepare(
        `SELECT date, type, SUM(amount_cents) AS total FROM expenses
         WHERE user_id = ? AND date BETWEEN ? AND ? GROUP BY date, type`,
      )
      .bind(userId, from, to),
    db
      .prepare(
        `SELECT date, SUM(amount_cents) AS total FROM savings_moves
         WHERE user_id = ? AND date BETWEEN ? AND ? GROUP BY date`,
      )
      .bind(userId, from, to),
  ]);

  const summaries: CycleSummary[] = ranges.map((r) => ({
    start: r.start,
    end: r.end,
    income_cents: 0,
    spent_cents: 0,
    needs_cents: 0,
    wants_cents: 0,
    saved_cents: 0,
  }));
  const find = (date: string) => summaries.find((s) => date >= s.start && date <= s.end);

  for (const r of incomeRes?.results ?? []) {
    const s = find(String(r.date));
    if (s) s.income_cents += Number(r.total);
  }
  for (const r of expenseRes?.results ?? []) {
    const s = find(String(r.date));
    if (!s) continue;
    const total = Number(r.total);
    s.spent_cents += total;
    if (r.type === 'NEED') s.needs_cents += total;
    else s.wants_cents += total;
  }
  for (const r of savingsRes?.results ?? []) {
    const s = find(String(r.date));
    if (s) s.saved_cents += Number(r.total);
  }
  return summaries;
}
