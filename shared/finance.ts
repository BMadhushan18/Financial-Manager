// MoneyMind – all money and pay-cycle rules as small pure functions.
// Money is always INTEGER cents. Dates are ISO strings "YYYY-MM-DD" and are
// handled in UTC so that results never depend on the device time zone.

import type {
  BudgetProgress,
  CheckChoice,
  CycleMode,
  CycleRange,
  EntryType,
  Expense,
  NewExpense,
  PaymentMethod,
  Priority,
  ProgressBarData,
  PurchaseWarning,
  RolloverDecision,
  SavingsGoal,
  Urgency,
  WishStatus,
  WishlistItem,
} from './types';

/* ------------------------------------------------------------------ */
/* Money                                                               */
/* ------------------------------------------------------------------ */

/** Largest amount we accept: 10 trillion (in cents). Keeps maths far below 2^53. */
export const MAX_CENTS = 1_000_000_000_000_00;

const SYMBOLS: Record<string, string> = {
  LKR: 'Rs. ',
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AUD: 'A$',
  AED: 'AED ',
  SGD: 'S$',
};

export function currencySymbol(currency: string): string {
  return SYMBOLS[currency] ?? `${currency} `;
}

/**
 * Parse what a person typed ("1,250.50", "Rs. 99", ".5") into integer cents.
 * Uses string maths only – never floating point. Returns null when invalid.
 */
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input
    .trim()
    .replace(/^(rs\.?|lkr|inr|usd|aed|sgd|a\$|s\$|\$|₹|€|£)\s*/i, '')
    .replace(/[,\s]/g, '');
  const match = /^(-)?(\d*)(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!match) return null;
  const [, minus, whole = '', frac = ''] = match;
  if (whole === '' && frac === '') return null;
  if (whole.length > 13) return null;
  const cents = Number(whole || '0') * 100 + Number(frac.padEnd(2, '0'));
  if (cents > MAX_CENTS) return null;
  return minus ? -cents : cents;
}

/** 125050 → "Rs. 1,250.50" (or "-Rs. 1,250.50"). */
export function formatMoney(cents: number, currency = 'LKR'): string {
  const value = Math.trunc(cents);
  const abs = Math.abs(value);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${value < 0 ? '-' : ''}${currencySymbol(currency)}${wholeStr}.${frac
    .toString()
    .padStart(2, '0')}`;
}

/** 125050 → "1250.50" – for pre-filling inputs. */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '';
  const abs = Math.abs(Math.trunc(cents));
  const s = `${Math.floor(abs / 100)}.${(abs % 100).toString().padStart(2, '0')}`;
  return cents < 0 ? `-${s}` : s;
}

/** A whole-number percent of an amount, rounded to the nearest cent (half up). */
export function percentOf(cents: number, percent: number): number {
  return Math.round((cents * percent) / 100);
}

export function sumCents(values: Array<number | null | undefined>): number {
  let total = 0;
  for (const v of values) total += v ?? 0;
  return total;
}

/** Whole percent of part/whole, safe when whole is 0. */
export function ratioPercent(part: number, whole: number): number {
  if (whole <= 0) return part > 0 ? 100 : 0;
  return Math.round((part * 100) / whole);
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export function isValidISODate(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const m = ISO_RE.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return y >= 1970 && y <= 9999 && mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

function parts(iso: string): { y: number; m: number; d: number } {
  const match = ISO_RE.exec(iso);
  if (!match) throw new Error(`Invalid date: ${iso}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

export function toISODate(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Number of days in month m (1–12). */
export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Day `day` of the month, or the last day if the month is shorter. */
export function clampDay(y: number, m: number, day: number): string {
  return toISODate(y, m, Math.min(day, daysInMonth(y, m)));
}

export function addMonths(y: number, m: number, delta: number): { y: number; m: number } {
  const index = y * 12 + (m - 1) + delta;
  return { y: Math.floor(index / 12), m: (index % 12) + 1 };
}

export function addDays(iso: string, n: number): string {
  const { y, m, d } = parts(iso);
  const dt = new Date(Date.UTC(y, m - 1, d) + n * DAY_MS);
  return toISODate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** b − a in whole days. */
export function daysBetween(a: string, b: string): number {
  const pa = parts(a);
  const pb = parts(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / DAY_MS);
}

/** Today's date on this device (local time). */
export function localTodayISO(now: Date = new Date()): string {
  return toISODate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** Today's date in UTC. */
export function utcTodayISO(now: Date = new Date()): string {
  return toISODate(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
}

/* ------------------------------------------------------------------ */
/* Pay cycle                                                           */
/* ------------------------------------------------------------------ */

/**
 * The pay cycle that contains `today`.
 * - salary mode: from salary day to the day before the next salary day.
 *   A salary day that does not exist in a month (e.g. 31st) becomes the
 *   last day of that month.
 * - calendar mode: 1st to last day of the month.
 */
export function getCycle(today: string, salaryDay: number, mode: CycleMode): CycleRange {
  const { y, m } = parts(today);
  if (mode === 'calendar') {
    return { start: toISODate(y, m, 1), end: toISODate(y, m, daysInMonth(y, m)) };
  }
  const day = Math.min(Math.max(Math.trunc(salaryDay), 1), 31);
  let start = clampDay(y, m, day);
  let startMonth = { y, m };
  if (today < start) {
    startMonth = addMonths(y, m, -1);
    start = clampDay(startMonth.y, startMonth.m, day);
  }
  const next = addMonths(startMonth.y, startMonth.m, 1);
  const end = addDays(clampDay(next.y, next.m, day), -1);
  return { start, end };
}

export function nextCycle(cycle: CycleRange, salaryDay: number, mode: CycleMode): CycleRange {
  return getCycle(addDays(cycle.end, 1), salaryDay, mode);
}

export function previousCycle(cycle: CycleRange, salaryDay: number, mode: CycleMode): CycleRange {
  return getCycle(addDays(cycle.start, -1), salaryDay, mode);
}

/** The last `count` cycles up to and including the one containing `today`, oldest first. */
export function lastCycles(
  today: string,
  count: number,
  salaryDay: number,
  mode: CycleMode,
): CycleRange[] {
  const list: CycleRange[] = [];
  let c = getCycle(today, salaryDay, mode);
  for (let i = 0; i < count; i++) {
    list.unshift(c);
    c = previousCycle(c, salaryDay, mode);
  }
  return list;
}

/** Days left in the cycle, counting today. */
export function daysLeftInCycle(today: string, cycle: CycleRange): number {
  return Math.max(daysBetween(today, cycle.end) + 1, 1);
}

export function isInCycle(date: string, cycle: CycleRange): boolean {
  return date >= cycle.start && date <= cycle.end;
}

/** The date inside the cycle on which a bill with `dueDay` falls. */
export function billDueDate(cycle: CycleRange, dueDay: number): string {
  const { y, m } = parts(cycle.start);
  let candidate = clampDay(y, m, dueDay);
  if (candidate < cycle.start) {
    const n = addMonths(y, m, 1);
    candidate = clampDay(n.y, n.m, dueDay);
  }
  return candidate <= cycle.end ? candidate : cycle.end;
}

/* ------------------------------------------------------------------ */
/* Safe to spend and budget progress                                   */
/* ------------------------------------------------------------------ */

/** Savings goal for a cycle in cents. */
export function savingsGoalCents(goal: SavingsGoal, incomeCents: number): number {
  if (goal.mode === 'percent') return Math.max(percentOf(incomeCents, goal.percent), 0);
  return Math.max(goal.amount_cents, 0);
}

/** Paid bills count with what was actually paid, unpaid bills with their amount. */
export function billsCommitted(
  bills: Array<{ amount_cents: number; paid_cents: number | null; is_paid: boolean }>,
): { total: number; paid: number; unpaid: number } {
  let paid = 0;
  let unpaid = 0;
  for (const b of bills) {
    if (b.is_paid) paid += b.paid_cents ?? b.amount_cents;
    else unpaid += b.amount_cents;
  }
  return { total: paid + unpaid, paid, unpaid };
}

export interface SafeToSpendInput {
  incomeCents: number; // received + expected
  unpaidBillsCents: number;
  paidBillsCents: number;
  savingsGoalCents: number;
  savingsMovedCents: number;
  reservedCents: number; // planned wishlist items not bought yet
  otherExpensesCents: number; // every expense this cycle not linked to a fixed bill
}

/**
 * safe_to_spend = income − unpaid bills − paid bills
 *   − (savings goal not yet moved + savings already moved)
 *   − reserved planned items − all other expenses.
 */
export function computeSafeToSpend(i: SafeToSpendInput): number {
  const savingsNotYetMoved = Math.max(i.savingsGoalCents - i.savingsMovedCents, 0);
  return (
    i.incomeCents -
    i.unpaidBillsCents -
    i.paidBillsCents -
    (savingsNotYetMoved + i.savingsMovedCents) -
    i.reservedCents -
    i.otherExpensesCents
  );
}

/** Safe amount per day for the rest of the cycle (rounded toward zero). */
export function safePerDay(safeCents: number, daysLeft: number): number {
  if (daysLeft <= 0) return safeCents;
  return Math.trunc(safeCents / daysLeft);
}

function bar(plan: number, actual: number): ProgressBarData {
  return {
    plan_cents: plan,
    actual_cents: actual,
    percent: ratioPercent(actual, plan),
    over_cents: Math.max(actual - plan, 0),
  };
}

/** Needs / wants / savings vs the 50/30/20 (or custom) plan. */
export function budgetProgress(
  incomeCents: number,
  split: { needs: number; wants: number; savings: number },
  actual: { needs: number; wants: number; savings: number },
): BudgetProgress {
  return {
    needs: bar(percentOf(incomeCents, split.needs), actual.needs),
    wants: bar(percentOf(incomeCents, split.wants), actual.wants),
    savings: bar(percentOf(incomeCents, split.savings), actual.savings),
  };
}

export function isValidSplit(needs: number, wants: number, savings: number): boolean {
  return (
    [needs, wants, savings].every((n) => Number.isInteger(n) && n >= 0 && n <= 100) &&
    needs + wants + savings === 100
  );
}

/** Default emergency fund = months × monthly needs. */
export function emergencyTarget(monthlyNeedsCents: number, months: number): number {
  return Math.max(monthlyNeedsCents, 0) * Math.max(months, 0);
}

/* ------------------------------------------------------------------ */
/* Needs vs wants suggestion                                           */
/* ------------------------------------------------------------------ */

const NEED_KEYWORDS = [
  'medicine',
  'medical',
  'doctor',
  'hospital',
  'pharmacy',
  'tablet',
  'rice',
  'grocer',
  'vegetable',
  'milk',
  'bread',
  'school fees',
  'school',
  'tuition',
  'fees',
  'rent',
  'electric',
  'water bill',
  'gas',
  'fuel',
  'petrol',
  'bus',
  'train',
  'insurance',
  'uniform',
  'textbook',
  'baby',
  'diaper',
  'nappy',
  'soap',
  'toothpaste',
  'repair',
  'glasses',
  'spectacles',
];

const WANT_KEYWORDS = [
  'headphone',
  'earbud',
  'airpods',
  'new phone',
  'iphone',
  'watch',
  'smartwatch',
  'gaming',
  'console',
  'playstation',
  'xbox',
  'nintendo',
  'tv',
  'television',
  'movie',
  'concert',
  'perfume',
  'jewel',
  'sneaker',
  'handbag',
  'holiday',
  'vacation',
  'trip',
  'camera',
  'drone',
  'speaker',
  'game',
  'tablet upgrade',
  'designer',
  'luxury',
];

function findKeyword(name: string, list: string[]): string | undefined {
  const n = name.toLowerCase();
  return list.find((k) => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(n));
}

/**
 * Rule-based NEED/WANT suggestion with a human reason.
 * Category label wins; otherwise simple keyword lists decide.
 */
export function suggestType(
  name: string,
  category?: { name: string; type: EntryType } | null,
): { type: EntryType; reason: string } {
  if (category) {
    return {
      type: category.type,
      reason: `Suggested ${category.type} because category is ${category.name}`,
    };
  }
  const want = findKeyword(name, WANT_KEYWORDS);
  if (want) return { type: 'WANT', reason: `Suggested WANT because the name mentions "${want}"` };
  const need = findKeyword(name, NEED_KEYWORDS);
  if (need) return { type: 'NEED', reason: `Suggested NEED because the name mentions "${need}"` };
  return {
    type: 'WANT',
    reason: 'Suggested WANT because nothing marks it as essential – change it if it is a need',
  };
}

/* ------------------------------------------------------------------ */
/* Wishlist priority score                                             */
/* ------------------------------------------------------------------ */

export function itemTotalCents(item: { estimated_cents: number | null; quantity: number }): number {
  return (item.estimated_cents ?? 0) * Math.max(item.quantity, 1);
}

export interface ScoreInput {
  type: EntryType;
  urgency: Urgency;
  priority: Priority;
  estimated_cents: number | null;
  quantity: number;
  added_at: string;
  status: WishStatus;
  target_cycle: string | null;
}

/**
 * Priority score 0–100:
 * NEED +40 / WANT +10; NOW +30, THIS MONTH +20, SOMEDAY +0;
 * HIGH +20, MEDIUM +10, LOW +0; fits in safe-to-spend +10, else −10;
 * WANT waiting 30+ days +5.
 */
export function priorityScore(
  item: ScoreInput,
  ctx: { safeToSpendCents: number; today: string; cycleStart: string },
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  if (item.type === 'NEED') {
    score += 40;
    reasons.push('Need +40');
  } else {
    score += 10;
    reasons.push('Want +10');
  }
  const urgencyPts = item.urgency === 'NOW' ? 30 : item.urgency === 'THIS_MONTH' ? 20 : 0;
  score += urgencyPts;
  reasons.push(`Urgency +${urgencyPts}`);
  const priorityPts = item.priority === 'HIGH' ? 20 : item.priority === 'MEDIUM' ? 10 : 0;
  score += priorityPts;
  reasons.push(`Your priority +${priorityPts}`);

  const price = itemTotalCents(item);
  // A planned item's price is already reserved, so it "fits" against safe + its own reserve.
  const reservedForThis =
    item.status === 'PLANNED' && item.target_cycle === ctx.cycleStart ? price : 0;
  if (price <= ctx.safeToSpendCents + reservedForThis) {
    score += 10;
    reasons.push('Fits this month +10');
  } else {
    score -= 10;
    reasons.push('Does not fit this month −10');
  }
  if (item.type === 'WANT' && daysBetween(item.added_at, ctx.today) >= 30) {
    score += 5;
    reasons.push('Wanted for 30+ days +5');
  }
  return { score: Math.min(Math.max(score, 0), 100), reasons };
}

export function priorityLabel(score: number): string {
  if (score >= 70) return 'Top priority';
  if (score >= 45) return 'Important';
  if (score >= 25) return 'Nice to have';
  return 'Can wait';
}

export type WishSort = 'score' | 'price' | 'date';

export function sortWishes<T extends { score: number; item: WishlistItem }>(
  list: T[],
  sort: WishSort,
): T[] {
  const copy = [...list];
  copy.sort((a, b) => {
    if (sort === 'price') return itemTotalCents(b.item) - itemTotalCents(a.item);
    if (sort === 'date')
      return b.item.added_at.localeCompare(a.item.added_at) || b.item.id - a.item.id;
    return b.score - a.score || a.item.added_at.localeCompare(b.item.added_at);
  });
  return copy;
}

/* ------------------------------------------------------------------ */
/* Smart warning before buying                                         */
/* ------------------------------------------------------------------ */

export interface PurchaseCheckInput {
  priceCents: number;
  type: EntryType;
  /** When the item was added to the wishlist; null for a direct expense (treated as today). */
  addedAt: string | null;
  today: string;
  /** Amount already reserved for this exact purchase inside safe-to-spend (planned items). */
  reservedForThisCents: number;
  unpaidNeedBillsCents: number;
  wantsSpentCents: number;
  wantsPlanCents: number;
  savingsGoalCents: number;
  savingsMovedCents: number;
  safeToSpendCents: number;
  monthlyIncomeCents: number;
  bigWantPercent: number;
  coolingDays: number;
  currency: string;
  cycleMode: CycleMode;
}

/**
 * Returns every warning that applies. Empty list = no sheet is shown.
 * NEED purchases only get the unpaid-bills and short-until-payday checks.
 */
export function runPurchaseChecks(i: PurchaseCheckInput): PurchaseWarning[] {
  const fmt = (c: number) => formatMoney(c, i.currency);
  const until = i.cycleMode === 'salary' ? 'until salary day' : 'until the end of the month';
  const warnings: PurchaseWarning[] = [];
  const isWant = i.type === 'WANT';

  // New money this purchase takes out of safe-to-spend.
  const extra = Math.max(i.priceCents - i.reservedForThisCents, 0);
  const safeAfter = i.safeToSpendCents - extra;

  // 1. Unpaid NEED bills.
  if (i.unpaidNeedBillsCents > 0) {
    warnings.push({
      code: 'UNPAID_BILLS',
      amount_cents: i.unpaidNeedBillsCents,
      message: isWant
        ? `You still have ${fmt(i.unpaidNeedBillsCents)} in bills to pay.`
        : `Just so you know, ${fmt(i.unpaidNeedBillsCents)} in bills is still due this cycle.`,
    });
  }

  if (isWant) {
    // 2. Wants budget goes over.
    const wantsAfter = i.wantsSpentCents + i.priceCents;
    if (wantsAfter > i.wantsPlanCents) {
      const over = wantsAfter - i.wantsPlanCents;
      warnings.push({
        code: 'WANTS_OVER',
        amount_cents: over,
        message: `This puts your wants budget ${fmt(over)} over.`,
      });
    }

    // 3. Savings goal at risk – money beyond safe-to-spend comes out of savings not yet moved.
    const savingsNotYetMoved = Math.max(i.savingsGoalCents - i.savingsMovedCents, 0);
    if (savingsNotYetMoved > 0 && safeAfter < 0) {
      const dropBy = Math.min(-safeAfter, savingsNotYetMoved);
      const newGoal = i.savingsGoalCents - dropBy;
      warnings.push({
        code: 'SAVINGS_RISK',
        amount_cents: newGoal,
        message: `Your savings goal for this month will drop to ${fmt(newGoal)}.`,
      });
    }
  }

  // 4. Short until payday.
  if (safeAfter < 0) {
    warnings.push({
      code: 'SHORT',
      amount_cents: -safeAfter,
      message: isWant
        ? `You will be ${fmt(-safeAfter)} short ${until}.`
        : `This leaves you ${fmt(-safeAfter)} short ${until}. If it is essential, that is okay – maybe pause a want instead.`,
    });
  }

  // 5. Big want, recently added → cooling-off suggestion.
  if (isWant && i.monthlyIncomeCents > 0) {
    const threshold = percentOf(i.monthlyIncomeCents, i.bigWantPercent);
    const age = i.addedAt ? daysBetween(i.addedAt, i.today) : 0;
    if (i.priceCents > threshold && age < i.coolingDays) {
      warnings.push({
        code: 'COOLING_OFF',
        amount_cents: i.priceCents,
        message: `Many people wait a few days before big wants. Remind me in ${i.coolingDays} days?`,
      });
    }
  }

  return warnings;
}

/** Does a planned purchase fit in safe-to-spend? */
export function planFits(
  priceCents: number,
  safeToSpendCents: number,
): {
  fits: boolean;
  missingCents: number;
} {
  const missing = Math.max(priceCents - Math.max(safeToSpendCents, 0), 0);
  return { fits: missing === 0, missingCents: missing };
}

/** Choices that count as "a want you skipped or paused" in reports. */
export function isSkipChoice(choice: CheckChoice): boolean {
  return choice !== 'buy';
}

/* ------------------------------------------------------------------ */
/* Wishlist ⇄ expense linking                                          */
/* ------------------------------------------------------------------ */

export function canMarkBought(item: Pick<WishlistItem, 'status'>): string | null {
  if (item.status === 'BOUGHT') return 'This item is already marked as bought.';
  if (item.status === 'DROPPED') return 'This item was dropped. Restore it first.';
  return null;
}

/** The ONE expense created when a wishlist item is marked bought. */
export function buildBoughtExpense(
  item: Pick<WishlistItem, 'id' | 'name' | 'category_id' | 'type'>,
  input: { actual_cents: number; date: string; payment_method: PaymentMethod },
): NewExpense {
  return {
    amount_cents: input.actual_cents,
    date: input.date,
    category_id: item.category_id,
    type: item.type,
    payment_method: input.payment_method,
    note: item.name,
    wishlist_item_id: item.id,
    fixed_bill_id: null,
    refund_of: null,
  };
}

/** Where an item goes on undo. Returns null when there is nothing to undo. */
export function undoStatus(item: Pick<WishlistItem, 'status' | 'prev_status'>): WishStatus | null {
  if (item.status !== 'BOUGHT' && item.status !== 'DROPPED') return null;
  const prev = item.prev_status;
  if (prev === 'IDEA' || prev === 'PLANNED') return prev;
  return 'IDEA';
}

/** Copy of a bought item for a recurring wish ("new shoes every 6 months"). */
export function buildRepeatWish(item: WishlistItem, today: string): Omit<WishlistItem, 'id'> {
  const unit =
    item.actual_cents !== null
      ? Math.round(item.actual_cents / Math.max(item.quantity, 1))
      : item.estimated_cents;
  return {
    ...item,
    estimated_cents: unit,
    status: 'IDEA',
    prev_status: null,
    added_at: today,
    target_cycle: null,
    reminder_date: null,
    bought_at: null,
    actual_cents: null,
    payment_method: null,
    dropped_at: null,
    repeat_of: item.id,
    expense_id: null,
  };
}

/* ------------------------------------------------------------------ */
/* Refunds                                                             */
/* ------------------------------------------------------------------ */

/** Returns an error message, or null when the refund is allowed. */
export function validateRefund(
  original: Pick<Expense, 'amount_cents' | 'refund_of'>,
  alreadyRefundedCents: number,
  refundCents: number,
  currency = 'LKR',
): string | null {
  if (original.refund_of !== null) return 'A refund cannot be refunded again.';
  if (original.amount_cents <= 0) return 'Only a normal expense can be refunded.';
  if (!Number.isInteger(refundCents) || refundCents <= 0) return 'Refund must be more than zero.';
  const left = original.amount_cents - alreadyRefundedCents;
  if (refundCents > left) {
    return `You can refund up to ${formatMoney(left, currency)} on this expense.`;
  }
  return null;
}

/** A refund is a negative expense linked to the original. */
export function buildRefundExpense(
  original: Expense,
  refundCents: number,
  date: string,
  note: string | null,
): NewExpense {
  return {
    amount_cents: -refundCents,
    date,
    category_id: original.category_id,
    type: original.type,
    payment_method: original.payment_method,
    note: note ?? `Refund${original.note ? `: ${original.note}` : ''}`,
    wishlist_item_id: null,
    fixed_bill_id: null,
    refund_of: original.id,
  };
}

/* ------------------------------------------------------------------ */
/* Cycle rollover                                                      */
/* ------------------------------------------------------------------ */

export interface RolloverUpdate {
  id: number;
  status: WishStatus;
  target_cycle: string | null;
  dropped_at: string | null;
  prev_status: WishStatus | null;
}

/**
 * PLANNED items left at the end of a cycle need an explicit decision each:
 * next → planned in the new cycle, idea → back to the lifetime list,
 * drop → dropped. Items without a decision are reported in `missing` and
 * are never moved silently.
 */
export function planRollover(
  items: Array<Pick<WishlistItem, 'id' | 'status'>>,
  decisions: Record<string, RolloverDecision | undefined>,
  newCycleStart: string,
  today: string,
): { updates: RolloverUpdate[]; missing: number[] } {
  const updates: RolloverUpdate[] = [];
  const missing: number[] = [];
  for (const item of items) {
    if (item.status !== 'PLANNED') continue;
    const d = decisions[String(item.id)];
    if (d === 'next') {
      updates.push({
        id: item.id,
        status: 'PLANNED',
        target_cycle: newCycleStart,
        dropped_at: null,
        prev_status: 'PLANNED',
      });
    } else if (d === 'idea') {
      updates.push({
        id: item.id,
        status: 'IDEA',
        target_cycle: null,
        dropped_at: null,
        prev_status: 'PLANNED',
      });
    } else if (d === 'drop') {
      updates.push({
        id: item.id,
        status: 'DROPPED',
        target_cycle: null,
        dropped_at: today,
        prev_status: 'PLANNED',
      });
    } else {
      missing.push(item.id);
    }
  }
  return { updates, missing };
}
