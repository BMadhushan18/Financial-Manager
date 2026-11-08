import { useEffect, useMemo, useRef, useState } from 'react';
import type { Chart as ChartType, ChartConfiguration } from 'chart.js';
import { centsToInput, lastCycles, ratioPercent } from '../../shared/finance';
import type { Expense, ReportsResponse } from '../../shared/types';
import { Icon } from '../components/Icon';
import { EmptyState, ErrorBox, LoadingCards, Money } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { useApp } from '../lib/context';
import { useApi } from '../lib/hooks';
import { formatShort, METHOD_LABEL } from '../lib/labels';

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Canvas that lazy-loads Chart.js (only the parts we use). */
function ChartCanvas({ config, label }: { config: ChartConfiguration; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let chart: ChartType | null = null;
    let cancelled = false;
    void import('chart.js').then((m) => {
      if (cancelled || !canvas.current) return;
      m.Chart.register(
        m.BarController,
        m.BarElement,
        m.LineController,
        m.LineElement,
        m.PointElement,
        m.CategoryScale,
        m.LinearScale,
        m.Tooltip,
        m.Legend,
      );
      m.Chart.defaults.color = cssVar('--muted');
      m.Chart.defaults.borderColor = cssVar('--border');
      m.Chart.defaults.animation = false; // calm UI, and charts are ready instantly
      chart = new m.Chart(canvas.current, config);
    });
    return () => {
      cancelled = true;
      chart?.destroy();
    };
  }, [config]);
  return (
    <div className="chart-box">
      <canvas ref={canvas} role="img" aria-label={label} />
    </div>
  );
}

export default function Reports() {
  const { boot, today, fmt, version, privacy, categoryById, toast, currency } = useApp();
  const s = boot!.settings;
  const cycles = useMemo(
    () => lastCycles(today, 6, s.salary_day, s.cycle_mode).reverse(),
    [today, s.salary_day, s.cycle_mode],
  );
  const [index, setIndex] = useState(0);
  const range = cycles[index] ?? cycles[0]!;
  const { data, error, loading, reload } = useApi<ReportsResponse>(
    `/api/reports?from=${range.start}&to=${range.end}`,
    [version],
  );

  const toMoney = (c: number) => Number(centsToInput(c)); // chart display only (never stored)

  const barConfig = useMemo<ChartConfiguration | null>(() => {
    if (!data || data.by_category.length === 0) return null;
    return {
      type: 'bar',
      data: {
        labels: data.by_category.map((c) => c.name),
        datasets: [
          {
            label: 'Spent',
            data: data.by_category.map((c) => toMoney(c.total_cents)),
            backgroundColor: data.by_category.map((c) => c.color),
            borderRadius: 6,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (ctx) => fmt(data.by_category[ctx.dataIndex]!.total_cents) },
          },
        },
        scales: { x: { ticks: { display: !privacy } } },
      },
    };
  }, [data, privacy, fmt]);

  const lineConfig = useMemo<ChartConfiguration | null>(() => {
    if (!data) return null;
    const labels = data.cycles.map((c) => formatShort(c.start));
    const series = (key: 'income_cents' | 'spent_cents' | 'saved_cents') =>
      data.cycles.map((c) => toMoney(c[key]));
    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Income',
            data: series('income_cents'),
            borderColor: cssVar('--primary'),
            backgroundColor: cssVar('--primary'),
            tension: 0.3,
          },
          {
            label: 'Spent',
            data: series('spent_cents'),
            borderColor: cssVar('--wants'),
            backgroundColor: cssVar('--wants'),
            tension: 0.3,
            borderDash: [6, 4],
          },
          {
            label: 'Saved',
            data: series('saved_cents'),
            borderColor: cssVar('--savings'),
            backgroundColor: cssVar('--savings'),
            tension: 0.3,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const c = data.cycles[ctx.dataIndex]!;
                const key = (['income_cents', 'spent_cents', 'saved_cents'] as const)[
                  ctx.datasetIndex
                ]!;
                return `${ctx.dataset.label}: ${fmt(c[key])}`;
              },
            },
          },
        },
        scales: { y: { ticks: { display: !privacy } } },
      },
    };
  }, [data, privacy, fmt]);

  const exportCsv = async () => {
    try {
      const res = await api<{ expenses: Expense[] }>(
        `/api/expenses?from=${range.start}&to=${range.end}`,
      );
      const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
      const rows = [
        [
          'date',
          'amount',
          'currency',
          'category',
          'type',
          'payment_method',
          'note',
          'linked_to',
        ].join(','),
        ...res.expenses
          .slice()
          .reverse()
          .map((e) =>
            [
              e.date,
              centsToInput(e.amount_cents),
              currency,
              esc(categoryById(e.category_id)?.name ?? ''),
              e.type,
              esc(METHOD_LABEL[e.payment_method]),
              esc(e.note ?? ''),
              e.wishlist_item_id
                ? 'wishlist'
                : e.fixed_bill_id
                  ? 'bill'
                  : e.refund_of
                    ? 'refund'
                    : '',
            ].join(','),
          ),
      ];
      const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `moneymind-expenses-${range.start}-to-${range.end}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      toast({ message: errorMessage(e), tone: 'error' });
    }
  };

  const sum = data?.summary;
  const needsWantsTotal = (sum?.needs_cents ?? 0) + (sum?.wants_cents ?? 0);

  return (
    <div className="stack">
      <div className="card flat spread" style={{ padding: 8 }}>
        <button
          className="icon-btn"
          disabled={index >= cycles.length - 1}
          onClick={() => setIndex((i) => i + 1)}
          aria-label="Older cycle"
        >
          <Icon name="left" />
        </button>
        <div style={{ textAlign: 'center' }}>
          <strong>
            {formatShort(range.start)} – {formatShort(range.end)}
          </strong>
          <div className="tiny muted">
            {index === 0 ? 'This cycle' : `${index} cycle${index > 1 ? 's' : ''} ago`}
          </div>
        </div>
        <button
          className="icon-btn"
          disabled={index === 0}
          onClick={() => setIndex((i) => i - 1)}
          aria-label="Newer cycle"
        >
          <Icon name="right" />
        </button>
      </div>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data ? (
        <LoadingCards count={3} />
      ) : data && sum ? (
        <>
          <section className="card" aria-labelledby="sum-h">
            <h2 id="sum-h" style={{ marginBottom: 12 }}>
              Cycle summary
            </h2>
            <div className="stat-grid">
              <div className="stat">
                <div className="tiny muted">Income</div>
                <div className="value">{fmt(sum.income_cents)}</div>
              </div>
              <div className="stat">
                <div className="tiny muted">Spent</div>
                <div className="value">{fmt(sum.spent_cents)}</div>
              </div>
              <div className="stat">
                <div className="tiny muted">Saved</div>
                <div className="value positive">{fmt(sum.saved_cents)}</div>
              </div>
              <div className="stat">
                <div className="tiny muted">Savings rate</div>
                <div className="value">{data.savings_rate_percent}%</div>
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <div className="spread small">
                <span>
                  <span className="tag need">
                    ● Needs {ratioPercent(sum.needs_cents, needsWantsTotal)}%
                  </span>{' '}
                  <span className="tag want">
                    ★ Wants {ratioPercent(sum.wants_cents, needsWantsTotal)}%
                  </span>
                </span>
                <span className="muted small">
                  Plan {s.split_needs}/{s.split_wants}
                </span>
              </div>
              <div
                className="progress-track"
                style={{ display: 'flex', marginTop: 6 }}
                aria-hidden="true"
              >
                <div
                  style={{
                    width: `${ratioPercent(sum.needs_cents, needsWantsTotal)}%`,
                    background: 'var(--needs)',
                  }}
                />
                <div style={{ flex: 1, background: 'var(--wants)' }} />
              </div>
              <p className="tiny muted" style={{ marginTop: 4 }}>
                Needs {fmt(sum.needs_cents)} · Wants {fmt(sum.wants_cents)}
              </p>
            </div>
          </section>

          <section className="card" aria-labelledby="saved-h">
            <h2 id="saved-h" style={{ marginBottom: 8 }}>
              🍃 Money saved by dropping or pausing wants
            </h2>
            <div className="stat-grid">
              <div className="stat">
                <div className="tiny muted">Dropped wants ({data.money_saved.dropped_count})</div>
                <div className="value positive">{fmt(data.money_saved.dropped_cents)}</div>
              </div>
              <div className="stat">
                <div className="tiny muted">
                  Paused after a warning ({data.money_saved.paused_count})
                </div>
                <div className="value">{fmt(data.money_saved.paused_cents)}</div>
              </div>
            </div>
            <p className="tiny muted" style={{ marginTop: 8 }}>
              "Paused" counts times you chose remind later, next month or cancel.
            </p>
          </section>

          <section className="card" aria-labelledby="em-h">
            <h2 id="em-h" style={{ marginBottom: 8 }}>
              Emergency fund
            </h2>
            <div className="spread small">
              <Money cents={data.emergency.balance_cents} />
              <span className="muted">
                goal {fmt(data.emergency.target_cents)} (
                {ratioPercent(
                  Math.max(data.emergency.balance_cents, 0),
                  data.emergency.target_cents,
                )}
                %)
              </span>
            </div>
            <div className="progress-track" style={{ marginTop: 6 }} aria-hidden="true">
              <div
                className="progress-fill"
                style={{
                  width: `${Math.min(ratioPercent(Math.max(data.emergency.balance_cents, 0), data.emergency.target_cents), 100)}%`,
                  background: 'var(--savings)',
                }}
              />
            </div>
          </section>

          <section className="card" aria-labelledby="cat-h">
            <h2 id="cat-h" style={{ marginBottom: 8 }}>
              Spending by category
            </h2>
            {barConfig ? (
              <>
                <ChartCanvas config={barConfig} label="Bar chart of spending by category" />
                <ul className="list small" style={{ marginTop: 8 }}>
                  {data.by_category.map((c) => (
                    <li key={c.name} style={{ minHeight: 36, padding: '4px 0' }}>
                      <span
                        aria-hidden="true"
                        style={{ width: 10, height: 10, borderRadius: 3, background: c.color }}
                      />
                      <span className="grow">{c.name}</span>
                      <Money cents={c.total_cents} />
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <EmptyState emoji="📊" title="No spending in this cycle" />
            )}
          </section>

          <section className="card" aria-labelledby="trend-h">
            <h2 id="trend-h" style={{ marginBottom: 8 }}>
              Last 6 cycles
            </h2>
            {lineConfig && (
              <ChartCanvas
                config={lineConfig}
                label="Line chart of income, spending and savings over the last 6 cycles"
              />
            )}
          </section>

          <button className="btn block" onClick={() => void exportCsv()}>
            <Icon name="download" /> Export this cycle as CSV
          </button>
        </>
      ) : null}
    </div>
  );
}
