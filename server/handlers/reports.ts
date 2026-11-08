// Reports for a date range (default: the current cycle) + last 6 cycles.
import { isValidISODate, lastCycles, ratioPercent } from '../../shared/finance';
import type { ReportsResponse } from '../../shared/types';
import { cycleSummaries, loadCycleContext } from '../context';
import { json } from '../http';
import { route } from '../router';

type Row = Record<string, unknown>;

route('GET', '/api/reports', async ({ db, userId, url, today }) => {
  const ctx = await loadCycleContext(db, userId, today);
  const s = ctx.settings;
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');
  const from = isValidISODate(fromParam) ? fromParam : ctx.cycle.start;
  const to = isValidISODate(toParam) && toParam >= from ? toParam : ctx.cycle.end;

  const trendRanges = lastCycles(to, 6, s.salary_day, s.cycle_mode);
  const [trend, [summary]] = await Promise.all([
    cycleSummaries(db, userId, trendRanges),
    cycleSummaries(db, userId, [{ start: from, end: to }]),
  ]);

  const [byCat, dropped, paused] = await db.batch<Row>([
    db
      .prepare(
        `SELECT e.category_id, COALESCE(c.name, 'Uncategorised') AS name, COALESCE(c.color, '#94A3B8') AS color,
                SUM(e.amount_cents) AS total
         FROM expenses e LEFT JOIN categories c ON c.id = e.category_id
         WHERE e.user_id = ? AND e.date BETWEEN ? AND ?
         GROUP BY e.category_id HAVING total > 0 ORDER BY total DESC`,
      )
      .bind(userId, from, to),
    db
      .prepare(
        `SELECT COUNT(*) AS n, COALESCE(SUM(COALESCE(estimated_cents, 0) * quantity), 0) AS total
         FROM wishlist_items WHERE user_id = ? AND status = 'DROPPED' AND type = 'WANT'
           AND dropped_at BETWEEN ? AND ?`,
      )
      .bind(userId, from, to),
    db
      .prepare(
        `SELECT COUNT(*) AS n, COALESCE(SUM(amount_cents), 0) AS total FROM purchase_checks
         WHERE user_id = ? AND type = 'WANT' AND choice <> 'buy' AND substr(created_at, 1, 10) BETWEEN ? AND ?`,
      )
      .bind(userId, from, to),
  ]);

  const sum = summary ?? {
    start: from,
    end: to,
    income_cents: 0,
    spent_cents: 0,
    needs_cents: 0,
    wants_cents: 0,
    saved_cents: 0,
  };
  const body: ReportsResponse = {
    from,
    to,
    summary: sum,
    cycles: trend,
    by_category: (byCat?.results ?? []).map((r) => ({
      category_id: r.category_id === null ? null : Number(r.category_id),
      name: String(r.name),
      color: String(r.color),
      total_cents: Number(r.total),
    })),
    money_saved: {
      dropped_cents: Number(dropped?.results[0]?.total ?? 0),
      dropped_count: Number(dropped?.results[0]?.n ?? 0),
      paused_cents: Number(paused?.results[0]?.total ?? 0),
      paused_count: Number(paused?.results[0]?.n ?? 0),
    },
    savings_rate_percent: ratioPercent(Math.max(sum.saved_cents, 0), sum.income_cents),
    emergency: { balance_cents: ctx.savingsBalance, target_cents: ctx.emergencyTargetCents },
  };
  return json(body);
});
