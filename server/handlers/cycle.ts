// Current cycle, rollover (close), purchase checks.
import {
  addDays,
  itemTotalCents,
  planRollover,
  priorityLabel,
  priorityScore,
  runPurchaseChecks,
} from '../../shared/finance';
import {
  CHECK_CHOICES,
  ENTRY_TYPES,
  type CurrentCycleResponse,
  type RolloverDecision,
  type ScoredWish,
} from '../../shared/types';
import { cents, idParam, int, oneOf, ValidationError } from '../../shared/validation';
import { cycleSummaries, loadCycleContext } from '../context';
import { getWish } from '../db';
import { HttpError, json, readBody } from '../http';
import { route } from '../router';

route('GET', '/api/cycle/current', async ({ db, userId, today }) => {
  const ctx = await loadCycleContext(db, userId, today, { autoSalary: true });
  const scoreCtx = { safeToSpendCents: ctx.safe, today, cycleStart: ctx.cycle.start };
  const top: ScoredWish[] = ctx.activeWishes
    .map((item) => {
      const score = priorityScore(item, scoreCtx).score;
      return { item, score, label: priorityLabel(score) };
    })
    .sort((a, b) => b.score - a.score || a.item.added_at.localeCompare(b.item.added_at))
    .slice(0, 3);
  const weekAhead = addDays(today, 7);

  const body: CurrentCycleResponse = {
    today,
    cycle: ctx.cycle,
    next_cycle: ctx.next,
    days_left: ctx.daysLeft,
    totals: ctx.totals,
    safe_to_spend_cents: ctx.safe,
    safe_per_day_cents: ctx.perDay,
    progress: ctx.progress,
    incomes: ctx.incomes,
    bills: ctx.bills,
    upcoming_bills: ctx.bills.filter((b) => !b.is_paid && b.due_date <= weekAhead),
    planned: ctx.planned,
    reminders: ctx.activeWishes.filter((w) => w.reminder_date !== null && w.reminder_date <= today),
    top_wishes: top,
    savings: {
      goal: ctx.goal,
      moves: ctx.moves,
      balance_cents: ctx.savingsBalance,
      emergency_target_cents: ctx.emergencyTargetCents,
    },
    rollover:
      ctx.stalePlanned.length > 0
        ? { previous_cycle: ctx.previous, items: ctx.stalePlanned }
        : null,
    previous_closed: ctx.previousClosed,
  };
  return json(body);
});

/**
 * Close the previous cycle: store its summary and apply an explicit decision
 * for every PLANNED item left over (next / idea / drop). Never silent.
 */
route('POST', '/api/cycle/close', async ({ db, userId, request, today }) => {
  const b = await readBody(request);
  const raw = (b.decisions ?? {}) as Record<string, unknown>;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ValidationError('decisions', 'decisions must be an object.');
  }
  const decisions: Record<string, RolloverDecision> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v !== 'next' && v !== 'idea' && v !== 'drop') {
      throw new ValidationError('decisions', 'Each decision must be next, idea or drop.');
    }
    decisions[k] = v;
  }

  const ctx = await loadCycleContext(db, userId, today);
  const { updates, missing } = planRollover(ctx.stalePlanned, decisions, ctx.cycle.start, today);
  if (missing.length > 0) {
    throw new HttpError(
      400,
      'Please choose what to do with every planned item.',
      'MISSING_DECISIONS',
      { missing },
    );
  }

  const [summary] = await cycleSummaries(db, userId, [ctx.previous]);
  const stmts: D1PreparedStatement[] = updates.map((u) =>
    db
      .prepare(
        `UPDATE wishlist_items SET status = ?, target_cycle = ?, dropped_at = ?, prev_status = ?,
           updated_at = datetime('now') WHERE id = ? AND user_id = ? AND status = 'PLANNED'`,
      )
      .bind(u.status, u.target_cycle, u.dropped_at, u.prev_status, u.id, userId),
  );
  stmts.push(
    db
      .prepare(
        `INSERT INTO cycles (user_id, start_date, end_date, closed_at, summary) VALUES (?, ?, ?, datetime('now'), ?)
         ON CONFLICT(user_id, start_date) DO UPDATE SET closed_at = excluded.closed_at, summary = excluded.summary`,
      )
      .bind(userId, ctx.previous.start, ctx.previous.end, JSON.stringify(summary ?? null)),
  );
  await db.batch(stmts);
  return json({ ok: true, updated: updates.length, summary });
});

/** Returns warnings for a planned purchase. Does NOT save anything. */
route('POST', '/api/purchase-check', async ({ db, userId, request, today }) => {
  const b = await readBody(request);
  const ctx = await loadCycleContext(db, userId, today);
  if (!ctx.settings.warnings_enabled) return json({ warnings: [], enabled: false });

  const itemId = int(b, 'wishlist_item_id', { min: 1 });
  let type = oneOf(b, 'type', ENTRY_TYPES);
  let addedAt: string | null = null;
  let reserved = 0;
  let price = cents(b, 'amount_cents', { allowZero: false });

  if (itemId !== null) {
    const item = await getWish(db, idParam(String(itemId)), userId);
    type = type ?? item.type;
    addedAt = item.added_at;
    if (item.status === 'PLANNED' && item.target_cycle === ctx.cycle.start)
      reserved = itemTotalCents(item);
    price = price ?? itemTotalCents(item);
  } else {
    const categoryId = int(b, 'category_id', { min: 1 });
    if (!type && categoryId !== null) {
      const cat = await db
        .prepare('SELECT type FROM categories WHERE id = ? AND user_id = ?')
        .bind(categoryId, userId)
        .first<{ type: 'NEED' | 'WANT' }>();
      type = cat?.type ?? null;
    }
  }
  if (price === null) throw new ValidationError('amount_cents', 'Please enter an amount.');

  const warnings = runPurchaseChecks({
    priceCents: price,
    type: type ?? 'WANT',
    addedAt,
    today,
    reservedForThisCents: reserved,
    unpaidNeedBillsCents: ctx.totals.unpaid_need_bills_cents,
    wantsSpentCents: ctx.totals.wants_spent_cents,
    wantsPlanCents: ctx.progress.wants.plan_cents,
    savingsGoalCents: ctx.totals.savings_goal_cents,
    savingsMovedCents: ctx.totals.savings_moved_cents,
    safeToSpendCents: ctx.safe,
    monthlyIncomeCents: ctx.totals.income_cents || ctx.settings.salary_cents,
    bigWantPercent: ctx.settings.big_want_percent,
    coolingDays: ctx.settings.cooling_days,
    currency: ctx.settings.currency,
    cycleMode: ctx.settings.cycle_mode,
  });
  return json({ warnings, enabled: true, cooling_days: ctx.settings.cooling_days });
});

/** Log what the user chose after seeing a warning (for "wants you skipped"). */
route('POST', '/api/purchase-checks', async ({ db, userId, request }) => {
  const b = await readBody(request);
  const itemId = int(b, 'wishlist_item_id', { min: 1 });
  if (itemId !== null) await getWish(db, itemId, userId);
  const codes = Array.isArray(b.warnings)
    ? b.warnings.filter((x): x is string => typeof x === 'string').slice(0, 10)
    : [];
  await db
    .prepare(
      `INSERT INTO purchase_checks (user_id, wishlist_item_id, amount_cents, type, warnings, choice)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      userId,
      itemId,
      cents(b, 'amount_cents', { required: true }),
      oneOf(b, 'type', ENTRY_TYPES, { required: true }),
      JSON.stringify(codes),
      oneOf(b, 'choice', CHECK_CHOICES, { required: true }),
    )
    .run();
  return json({ ok: true }, 201);
});
