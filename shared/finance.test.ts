import { describe, expect, it } from 'vitest';
import {
  addDays,
  billDueDate,
  billsCommitted,
  budgetProgress,
  buildBoughtExpense,
  buildRefundExpense,
  buildRepeatWish,
  canMarkBought,
  centsToInput,
  computeSafeToSpend,
  daysBetween,
  daysLeftInCycle,
  formatMoney,
  getCycle,
  isValidISODate,
  isValidSplit,
  lastCycles,
  nextCycle,
  parseMoneyToCents,
  percentOf,
  planFits,
  planRollover,
  priorityLabel,
  priorityScore,
  runPurchaseChecks,
  safePerDay,
  savingsGoalCents,
  suggestType,
  undoStatus,
  validateRefund,
  type PurchaseCheckInput,
  type ScoreInput,
} from './finance';
import type { Expense, WishlistItem } from './types';

/* ---------------- cents & formatting ---------------- */

describe('money parsing and rounding (cents)', () => {
  it('parses typed amounts into integer cents without floating point', () => {
    expect(parseMoneyToCents('1,250.50')).toBe(125050);
    expect(parseMoneyToCents('Rs. 99')).toBe(9900);
    expect(parseMoneyToCents('0.1')).toBe(10);
    expect(parseMoneyToCents('.05')).toBe(5);
    expect(parseMoneyToCents('19.99')).toBe(1999);
    expect(parseMoneyToCents('-20')).toBe(-2000);
    expect(parseMoneyToCents('1 000 000')).toBe(100000000);
  });

  it('rejects invalid input and more than 2 decimals', () => {
    expect(parseMoneyToCents('')).toBeNull();
    expect(parseMoneyToCents('abc')).toBeNull();
    expect(parseMoneyToCents('1.234')).toBeNull();
    expect(parseMoneyToCents('.')).toBeNull();
    expect(parseMoneyToCents('99999999999999')).toBeNull();
  });

  it('avoids the classic 0.1 + 0.2 float error', () => {
    const a = parseMoneyToCents('0.10')!;
    const b = parseMoneyToCents('0.20')!;
    expect(a + b).toBe(30);
    expect(formatMoney(a + b)).toBe('Rs. 0.30');
  });

  it('formats as "Rs. 1,250.00" and handles negatives', () => {
    expect(formatMoney(125000)).toBe('Rs. 1,250.00');
    expect(formatMoney(5)).toBe('Rs. 0.05');
    expect(formatMoney(-200000)).toBe('-Rs. 2,000.00');
    expect(formatMoney(123456789)).toBe('Rs. 1,234,567.89');
    expect(formatMoney(1999, 'USD')).toBe('$19.99');
  });

  it('round-trips through the input format', () => {
    expect(centsToInput(125050)).toBe('1250.50');
    expect(centsToInput(-5)).toBe('-0.05');
    expect(parseMoneyToCents(centsToInput(987654))).toBe(987654);
  });

  it('rounds percentages to the nearest cent (half up)', () => {
    expect(percentOf(100000, 20)).toBe(20000);
    expect(percentOf(333, 50)).toBe(167); // 166.5 → 167
    expect(percentOf(1, 50)).toBe(1); // 0.5 → 1
    expect(percentOf(999, 10)).toBe(100); // 99.9 → 100
    expect(Number.isInteger(percentOf(12345, 33))).toBe(true);
  });
});

/* ---------------- cycle dates ---------------- */

describe('pay cycle dates', () => {
  it('runs from salary day to the day before next salary day', () => {
    expect(getCycle('2026-03-25', 25, 'salary')).toEqual({
      start: '2026-03-25',
      end: '2026-04-24',
    });
    expect(getCycle('2026-04-10', 25, 'salary')).toEqual({
      start: '2026-03-25',
      end: '2026-04-24',
    });
    expect(getCycle('2026-04-24', 25, 'salary')).toEqual({
      start: '2026-03-25',
      end: '2026-04-24',
    });
    expect(getCycle('2026-04-25', 25, 'salary')).toEqual({
      start: '2026-04-25',
      end: '2026-05-24',
    });
  });

  it('crosses the year boundary', () => {
    expect(getCycle('2026-01-05', 25, 'salary')).toEqual({
      start: '2025-12-25',
      end: '2026-01-24',
    });
  });

  it('uses the last day of short months for salary day 31', () => {
    expect(getCycle('2026-02-15', 31, 'salary')).toEqual({
      start: '2026-01-31',
      end: '2026-02-27',
    });
    expect(getCycle('2026-02-28', 31, 'salary')).toEqual({
      start: '2026-02-28',
      end: '2026-03-30',
    });
    expect(getCycle('2026-03-31', 31, 'salary')).toEqual({
      start: '2026-03-31',
      end: '2026-04-29',
    });
    expect(getCycle('2026-04-30', 31, 'salary')).toEqual({
      start: '2026-04-30',
      end: '2026-05-30',
    });
  });

  it('handles salary day 30 and 29 including leap years', () => {
    expect(getCycle('2026-02-28', 30, 'salary')).toEqual({
      start: '2026-02-28',
      end: '2026-03-29',
    });
    expect(getCycle('2026-02-27', 30, 'salary')).toEqual({
      start: '2026-01-30',
      end: '2026-02-27',
    });
    expect(getCycle('2028-02-29', 29, 'salary')).toEqual({
      start: '2028-02-29',
      end: '2028-03-28',
    });
    expect(getCycle('2027-02-28', 29, 'salary')).toEqual({
      start: '2027-02-28',
      end: '2027-03-28',
    });
    expect(getCycle('2027-02-27', 29, 'salary')).toEqual({
      start: '2027-01-29',
      end: '2027-02-27',
    });
  });

  it('cycles are continuous with no gaps or overlaps for every salary day', () => {
    for (const day of [1, 15, 28, 29, 30, 31]) {
      let c = getCycle('2026-01-01', day, 'salary');
      for (let i = 0; i < 30; i++) {
        const n = nextCycle(c, day, 'salary');
        expect(n.start).toBe(addDays(c.end, 1));
        expect(n.start <= n.end).toBe(true);
        c = n;
      }
    }
  });

  it('supports calendar month mode', () => {
    expect(getCycle('2026-02-10', 25, 'calendar')).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    });
    expect(getCycle('2028-02-10', 25, 'calendar')).toEqual({
      start: '2028-02-01',
      end: '2028-02-29',
    });
  });

  it('counts days left including today', () => {
    expect(daysLeftInCycle('2026-04-24', { start: '2026-03-25', end: '2026-04-24' })).toBe(1);
    expect(daysLeftInCycle('2026-04-20', { start: '2026-03-25', end: '2026-04-24' })).toBe(5);
  });

  it('lists the last N cycles oldest first', () => {
    const list = lastCycles('2026-06-10', 3, 25, 'salary');
    expect(list.map((c) => c.start)).toEqual(['2026-03-25', '2026-04-25', '2026-05-25']);
  });

  it('places bill due dates inside the cycle', () => {
    const cycle = { start: '2026-03-25', end: '2026-04-24' };
    expect(billDueDate(cycle, 28)).toBe('2026-03-28');
    expect(billDueDate(cycle, 5)).toBe('2026-04-05');
    expect(billDueDate(cycle, 31)).toBe('2026-03-31');
  });

  it('validates ISO dates and date maths', () => {
    expect(isValidISODate('2026-02-29')).toBe(false);
    expect(isValidISODate('2028-02-29')).toBe(true);
    expect(isValidISODate('2026-13-01')).toBe(false);
    expect(daysBetween('2026-01-01', '2026-03-01')).toBe(59);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

/* ---------------- safe to spend ---------------- */

describe('safe to spend', () => {
  const base = {
    incomeCents: 20000000, // 200,000
    unpaidBillsCents: 3000000,
    paidBillsCents: 4000000,
    savingsGoalCents: 4000000,
    savingsMovedCents: 1000000,
    reservedCents: 1500000,
    otherExpensesCents: 2500000,
  };

  it('follows the formula from the spec', () => {
    // 200000 − 30000 − 40000 − (30000 + 10000) − 15000 − 25000 = 50000
    expect(computeSafeToSpend(base)).toBe(5000000);
  });

  it('counts savings moved beyond the goal', () => {
    expect(computeSafeToSpend({ ...base, savingsMovedCents: 5000000 })).toBe(4000000);
  });

  it('can be negative', () => {
    expect(computeSafeToSpend({ ...base, otherExpensesCents: 9000000 })).toBe(-1500000);
  });

  it('per day uses days left and stays an integer', () => {
    expect(safePerDay(1000000, 3)).toBe(333333);
    expect(safePerDay(-1000, 3)).toBe(-333);
    expect(safePerDay(500, 0)).toBe(500);
  });

  it('sums paid bills with the paid amount and unpaid with the bill amount', () => {
    expect(
      billsCommitted([
        { amount_cents: 1000, paid_cents: 900, is_paid: true },
        { amount_cents: 2000, paid_cents: null, is_paid: false },
      ]),
    ).toEqual({ total: 2900, paid: 900, unpaid: 2000 });
  });

  it('computes savings goal by amount or percent', () => {
    expect(savingsGoalCents({ mode: 'amount', amount_cents: 5000, percent: 0 }, 100000)).toBe(5000);
    expect(savingsGoalCents({ mode: 'percent', amount_cents: 0, percent: 20 }, 100000)).toBe(20000);
  });
});

/* ---------------- 50/30/20 ---------------- */

describe('50/30/20 progress', () => {
  it('computes plan, percent and over amount', () => {
    const p = budgetProgress(
      10000000,
      { needs: 50, wants: 30, savings: 20 },
      { needs: 2500000, wants: 3600000, savings: 2000000 },
    );
    expect(p.needs).toEqual({
      plan_cents: 5000000,
      actual_cents: 2500000,
      percent: 50,
      over_cents: 0,
    });
    expect(p.wants).toEqual({
      plan_cents: 3000000,
      actual_cents: 3600000,
      percent: 120,
      over_cents: 600000,
    });
    expect(p.savings.percent).toBe(100);
  });

  it('handles zero income without dividing by zero', () => {
    const p = budgetProgress(
      0,
      { needs: 50, wants: 30, savings: 20 },
      { needs: 100, wants: 0, savings: 0 },
    );
    expect(p.needs.percent).toBe(100);
    expect(p.wants.percent).toBe(0);
  });

  it('validates the split adds to 100', () => {
    expect(isValidSplit(50, 30, 20)).toBe(true);
    expect(isValidSplit(60, 30, 20)).toBe(false);
    expect(isValidSplit(50.5, 29.5, 20)).toBe(false);
  });
});

/* ---------------- suggestion & priority score ---------------- */

describe('needs vs wants suggestion', () => {
  it('uses the category label and explains why', () => {
    expect(suggestType('anything', { name: 'Gadgets', type: 'WANT' })).toEqual({
      type: 'WANT',
      reason: 'Suggested WANT because category is Gadgets',
    });
  });
  it('uses keywords when there is no category', () => {
    expect(suggestType('Medicine for mum').type).toBe('NEED');
    expect(suggestType('5kg rice').type).toBe('NEED');
    expect(suggestType('School fees term 2').type).toBe('NEED');
    expect(suggestType('Noise cancelling headphones').type).toBe('WANT');
    expect(suggestType('New phone').type).toBe('WANT');
    expect(suggestType('Smart watch').reason).toContain('watch');
  });
  it('does not match words inside other words', () => {
    // "price" contains "rice" but must not be treated as a need
    expect(suggestType('Price tag gun').type).toBe('WANT');
  });
});

describe('priority score', () => {
  const ctx = { safeToSpendCents: 5000000, today: '2026-04-10', cycleStart: '2026-03-25' };
  const item: ScoreInput = {
    type: 'NEED',
    urgency: 'NOW',
    priority: 'HIGH',
    estimated_cents: 100000,
    quantity: 1,
    added_at: '2026-04-09',
    status: 'IDEA',
    target_cycle: null,
  };

  it('scores a urgent high-priority need that fits as 100', () => {
    expect(priorityScore(item, ctx).score).toBe(100);
    expect(priorityLabel(100)).toBe('Top priority');
  });

  it('scores a someday low want that does not fit as 0 (clamped)', () => {
    const s = priorityScore(
      { ...item, type: 'WANT', urgency: 'SOMEDAY', priority: 'LOW', estimated_cents: 99999999 },
      ctx,
    );
    expect(s.score).toBe(0); // 10 + 0 + 0 − 10
    expect(priorityLabel(s.score)).toBe('Can wait');
  });

  it('adds +5 for wants waiting 30+ days', () => {
    const want = {
      ...item,
      type: 'WANT' as const,
      urgency: 'THIS_MONTH' as const,
      priority: 'MEDIUM' as const,
    };
    expect(priorityScore({ ...want, added_at: '2026-03-20' }, ctx).score).toBe(10 + 20 + 10 + 10);
    expect(priorityScore({ ...want, added_at: '2026-03-11' }, ctx).score).toBe(
      10 + 20 + 10 + 10 + 5,
    );
  });

  it('counts the reserved price of a planned item as fitting', () => {
    const planned = {
      ...item,
      estimated_cents: 6000000,
      status: 'PLANNED' as const,
      target_cycle: '2026-03-25',
    };
    expect(priorityScore(planned, ctx).reasons).toContain('Fits this month +10');
    expect(priorityScore({ ...planned, status: 'IDEA' }, ctx).reasons).toContain(
      'Does not fit this month −10',
    );
  });

  it('multiplies by quantity', () => {
    expect(
      priorityScore({ ...item, estimated_cents: 3000000, quantity: 2 }, ctx).reasons,
    ).toContain('Does not fit this month −10');
  });
});

/* ---------------- purchase checks ---------------- */

describe('smart purchase checks', () => {
  const base: PurchaseCheckInput = {
    priceCents: 500000,
    type: 'WANT',
    addedAt: '2026-03-01',
    today: '2026-04-10',
    reservedForThisCents: 0,
    unpaidNeedBillsCents: 0,
    wantsSpentCents: 0,
    wantsPlanCents: 6000000,
    savingsGoalCents: 4000000,
    savingsMovedCents: 4000000,
    safeToSpendCents: 5000000,
    monthlyIncomeCents: 20000000,
    bigWantPercent: 10,
    coolingDays: 7,
    currency: 'LKR',
    cycleMode: 'salary',
  };
  const codes = (i: PurchaseCheckInput) => runPurchaseChecks(i).map((w) => w.code);

  it('shows nothing when no rule matches', () => {
    expect(runPurchaseChecks(base)).toEqual([]);
  });

  it('rule 1: unpaid need bills', () => {
    const w = runPurchaseChecks({ ...base, unpaidNeedBillsCents: 3000000 });
    expect(w[0]).toMatchObject({ code: 'UNPAID_BILLS', amount_cents: 3000000 });
    expect(w[0]!.message).toBe('You still have Rs. 30,000.00 in bills to pay.');
  });

  it('rule 2: wants budget goes over', () => {
    const w = runPurchaseChecks({ ...base, wantsSpentCents: 5800000 });
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ code: 'WANTS_OVER', amount_cents: 300000 });
    expect(w[0]!.message).toBe('This puts your wants budget Rs. 3,000.00 over.');
  });

  it('rule 3: savings goal at risk when the want goes past safe-to-spend', () => {
    const w = runPurchaseChecks({
      ...base,
      safeToSpendCents: 200000,
      savingsMovedCents: 1000000,
    });
    const s = w.find((x) => x.code === 'SAVINGS_RISK')!;
    // short by 3,000 → goal 40,000 drops to 37,000
    expect(s.amount_cents).toBe(3700000);
    expect(s.message).toBe('Your savings goal for this month will drop to Rs. 37,000.00.');
  });

  it('rule 4: short until salary day', () => {
    const w = runPurchaseChecks({ ...base, safeToSpendCents: 200000 });
    const s = w.find((x) => x.code === 'SHORT')!;
    expect(s.amount_cents).toBe(300000);
    expect(s.message).toBe('You will be Rs. 3,000.00 short until salary day.');
    expect(codes({ ...base, safeToSpendCents: 200000, cycleMode: 'calendar' })).toContain('SHORT');
  });

  it('rule 5: big recent want suggests cooling-off', () => {
    const big = {
      ...base,
      priceCents: 2500000,
      wantsPlanCents: 99999999,
      safeToSpendCents: 99999999,
    };
    expect(codes({ ...big, addedAt: '2026-04-08' })).toEqual(['COOLING_OFF']);
    expect(codes({ ...big, addedAt: '2026-03-01' })).toEqual([]);
    // direct expense with no wishlist date is treated as added today
    expect(codes({ ...big, addedAt: null })).toEqual(['COOLING_OFF']);
    // user settings change the threshold
    expect(codes({ ...big, addedAt: '2026-04-08', bigWantPercent: 20 })).toEqual([]);
    expect(codes({ ...big, addedAt: '2026-04-08', coolingDays: 1 })).toEqual([]);
  });

  it('NEED purchases only get rules 1 and 4, with a helpful tone', () => {
    const w = runPurchaseChecks({
      ...base,
      type: 'NEED',
      priceCents: 9000000,
      wantsSpentCents: 99999999,
      unpaidNeedBillsCents: 100,
      savingsMovedCents: 0,
      addedAt: null,
    });
    expect(w.map((x) => x.code)).toEqual(['UNPAID_BILLS', 'SHORT']);
    expect(w[1]!.message).toContain('If it is essential, that is okay');
  });

  it('a planned item only counts the extra over its reserved amount', () => {
    expect(
      codes({ ...base, priceCents: 600000, safeToSpendCents: 0, reservedForThisCents: 600000 }),
    ).toEqual([]);
    expect(
      codes({ ...base, priceCents: 700000, safeToSpendCents: 0, reservedForThisCents: 600000 }),
    ).toContain('SHORT');
  });

  it('plan fit check reports what is missing', () => {
    expect(planFits(5000, 8000)).toEqual({ fits: true, missingCents: 0 });
    expect(planFits(5000, 3000)).toEqual({ fits: false, missingCents: 2000 });
    expect(planFits(5000, -1000)).toEqual({ fits: false, missingCents: 5000 });
  });
});

/* ---------------- wishlist ⇄ expense ---------------- */

const wish: WishlistItem = {
  id: 7,
  name: 'Running shoes',
  category_id: 3,
  type: 'WANT',
  priority: 'MEDIUM',
  urgency: 'THIS_MONTH',
  estimated_cents: 1500000,
  quantity: 1,
  link: null,
  note: null,
  status: 'PLANNED',
  prev_status: null,
  added_at: '2026-03-01',
  target_cycle: '2026-03-25',
  reminder_date: null,
  bought_at: null,
  actual_cents: null,
  payment_method: null,
  dropped_at: null,
  repeat_of: null,
  expense_id: null,
};

describe('bought → expense link and undo', () => {
  it('creates exactly one expense linked by wishlist_item_id', () => {
    const e = buildBoughtExpense(wish, {
      actual_cents: 1450000,
      date: '2026-04-02',
      payment_method: 'card',
    });
    expect(e).toEqual({
      amount_cents: 1450000,
      date: '2026-04-02',
      category_id: 3,
      type: 'WANT',
      payment_method: 'card',
      note: 'Running shoes',
      wishlist_item_id: 7,
      fixed_bill_id: null,
      refund_of: null,
    });
  });

  it('refuses to mark bought twice (no duplicate expenses)', () => {
    expect(canMarkBought(wish)).toBeNull();
    expect(canMarkBought({ status: 'BOUGHT' })).toMatch(/already/);
    expect(canMarkBought({ status: 'DROPPED' })).toMatch(/Restore/);
  });

  it('undo returns the item to its previous status', () => {
    expect(undoStatus({ status: 'BOUGHT', prev_status: 'PLANNED' })).toBe('PLANNED');
    expect(undoStatus({ status: 'BOUGHT', prev_status: 'IDEA' })).toBe('IDEA');
    expect(undoStatus({ status: 'BOUGHT', prev_status: null })).toBe('IDEA');
    expect(undoStatus({ status: 'DROPPED', prev_status: 'PLANNED' })).toBe('PLANNED');
    expect(undoStatus({ status: 'IDEA', prev_status: null })).toBeNull();
  });

  it('re-adds a recurring wish as a fresh idea at the paid unit price', () => {
    const bought = { ...wish, status: 'BOUGHT' as const, actual_cents: 3000000, quantity: 2 };
    const r = buildRepeatWish(bought, '2026-05-01');
    expect(r).toMatchObject({
      status: 'IDEA',
      estimated_cents: 1500000,
      added_at: '2026-05-01',
      repeat_of: 7,
      actual_cents: null,
    });
  });
});

describe('refunds', () => {
  const original: Expense = {
    id: 10,
    amount_cents: 500000,
    date: '2026-04-01',
    category_id: 2,
    type: 'WANT',
    payment_method: 'card',
    note: 'Jacket',
    wishlist_item_id: null,
    fixed_bill_id: null,
    refund_of: null,
    created_at: '2026-04-01 10:00:00',
  };

  it('builds a negative expense linked to the original', () => {
    const r = buildRefundExpense(original, 200000, '2026-04-05', null);
    expect(r.amount_cents).toBe(-200000);
    expect(r.refund_of).toBe(10);
    expect(r.note).toBe('Refund: Jacket');
    expect(r.wishlist_item_id).toBeNull();
  });

  it('never refunds more than was spent', () => {
    expect(validateRefund(original, 0, 500000)).toBeNull();
    expect(validateRefund(original, 300000, 200000)).toBeNull();
    expect(validateRefund(original, 300000, 200001)).toBe(
      'You can refund up to Rs. 2,000.00 on this expense.',
    );
    expect(validateRefund(original, 0, 0)).toMatch(/more than zero/);
    expect(validateRefund({ ...original, refund_of: 1 }, 0, 100)).toMatch(/cannot be refunded/);
  });
});

/* ---------------- rollover ---------------- */

describe('rollover of planned items', () => {
  const items = [
    { id: 1, status: 'PLANNED' as const },
    { id: 2, status: 'PLANNED' as const },
    { id: 3, status: 'PLANNED' as const },
    { id: 4, status: 'IDEA' as const },
  ];

  it('applies each explicit decision', () => {
    const r = planRollover(items, { 1: 'next', 2: 'idea', 3: 'drop' }, '2026-04-25', '2026-04-25');
    expect(r.missing).toEqual([]);
    expect(r.updates).toEqual([
      {
        id: 1,
        status: 'PLANNED',
        target_cycle: '2026-04-25',
        dropped_at: null,
        prev_status: 'PLANNED',
      },
      { id: 2, status: 'IDEA', target_cycle: null, dropped_at: null, prev_status: 'PLANNED' },
      {
        id: 3,
        status: 'DROPPED',
        target_cycle: null,
        dropped_at: '2026-04-25',
        prev_status: 'PLANNED',
      },
    ]);
  });

  it('never moves an item silently', () => {
    const r = planRollover(items, { 1: 'next' }, '2026-04-25', '2026-04-25');
    expect(r.missing).toEqual([2, 3]);
    expect(r.updates).toHaveLength(1);
  });
});
