import { useEffect, useMemo, useRef, useState } from 'react';
import type { Chart as ChartType, ChartConfiguration } from 'chart.js';
import { centsToInput, lastCycles, ratioPercent } from '../../shared/finance';
import type { Expense, ReportsResponse } from '../../shared/types';
import { BarChart3, Download, Leaf, LifeBuoy, Scale, TrendingUp } from 'lucide-react';
import {
  EmptyState,
  ErrorBox,
  LoadingPanels,
  Money,
  PanelHead,
  PeriodSwitcher,
} from '../components/ui';
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
            borderColor: cssVar('--brand'),
            backgroundColor: cssVar('--brand'),
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
  const needsPct = ratioPercent(sum?.needs_cents ?? 0, needsWantsTotal);
  const emergencyPct = data
    ? ratioPercent(Math.max(data.emergency.balance_cents, 0), data.emergency.target_cents)
    : 0;

  return (
    <div className="stack">
      <div className="toolbar">
        <PeriodSwitcher
          label={`${formatShort(range.start)} – ${formatShort(range.end)}`}
          sub={index === 0 ? 'Current cycle' : `${index} cycle${index > 1 ? 's' : ''} ago`}
          onPrev={() => setIndex((i) => i + 1)}
          onNext={() => setIndex((i) => i - 1)}
          prevDisabled={index >= cycles.length - 1}
          nextDisabled={index === 0}
        />
        <button className="btn" onClick={() => void exportCsv()}>
          <Download size={16} /> Export CSV
        </button>
      </div>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data ? (
        <LoadingPanels count={3} />
      ) : data && sum ? (
        <>
          <section className="kpis" aria-label="Cycle summary">
            <div className="panel kpi">
              <span className="kpi-label">Income</span>
              <span className="kpi-value">{fmt(sum.income_cents)}</span>
            </div>
            <div className="panel kpi">
              <span className="kpi-label">Spent</span>
              <span className="kpi-value">{fmt(sum.spent_cents)}</span>
            </div>
            <div className="panel kpi">
              <span className="kpi-label">Saved</span>
              <span className="kpi-value pos">{fmt(sum.saved_cents)}</span>
            </div>
            <div className="panel kpi">
              <span className="kpi-label">Savings rate</span>
              <span className="kpi-value">{data.savings_rate_percent}%</span>
              <span className="kpi-sub">Target {s.split_savings}%</span>
            </div>
          </section>

          <div className="grid grid-main">
            <section className="panel">
              <PanelHead title="Spending by category" icon={BarChart3} />
              {barConfig ? (
                <div className="panel-body">
                  <ChartCanvas config={barConfig} label="Bar chart of spending by category" />
                </div>
              ) : (
                <EmptyState icon={BarChart3} title="No spending in this cycle" />
              )}
              {data.by_category.length > 0 && (
                <ul className="rows" style={{ borderTop: '1px solid var(--border)' }}>
                  {data.by_category.map((c) => (
                    <li key={c.name} className="item" style={{ minHeight: 44 }}>
                      <span
                        aria-hidden="true"
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 3,
                          background: c.color,
                          flex: 'none',
                        }}
                      />
                      <span className="grow small">{c.name}</span>
                      <span className="tiny muted num">
                        {ratioPercent(c.total_cents, sum.spent_cents)}%
                      </span>
                      <Money cents={c.total_cents} className="item-amount" />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="stack">
              <section className="panel">
                <PanelHead
                  title="Needs vs wants"
                  icon={Scale}
                  subtitle={`Your plan: ${s.split_needs}% / ${s.split_wants}%`}
                />
                <div className="panel-body stack-sm">
                  <div className="split-bar" aria-hidden="true">
                    <div style={{ width: `${needsPct}%`, background: 'var(--needs)' }} />
                    <div style={{ flex: 1, background: 'var(--wants)' }} />
                  </div>
                  <div className="legend">
                    <span>
                      <i style={{ background: 'var(--needs)' }} /> Needs {needsPct}% ·{' '}
                      {fmt(sum.needs_cents)}
                    </span>
                    <span>
                      <i style={{ background: 'var(--wants)' }} /> Wants{' '}
                      {needsWantsTotal ? 100 - needsPct : 0}% · {fmt(sum.wants_cents)}
                    </span>
                  </div>
                </div>
              </section>

              <section className="panel">
                <PanelHead title="Money kept" icon={Leaf} subtitle="By dropping or pausing wants" />
                <div className="panel-body">
                  <div className="stats">
                    <div className="stat">
                      <div className="label">Dropped ({data.money_saved.dropped_count})</div>
                      <div className="value pos">{fmt(data.money_saved.dropped_cents)}</div>
                    </div>
                    <div className="stat">
                      <div className="label">Paused ({data.money_saved.paused_count})</div>
                      <div className="value">{fmt(data.money_saved.paused_cents)}</div>
                    </div>
                  </div>
                  <p className="hint" style={{ marginTop: 10 }}>
                    Paused = you chose remind later, next month or cancel after a warning.
                  </p>
                </div>
              </section>

              <section className="panel">
                <PanelHead title="Emergency fund" icon={LifeBuoy} />
                <div className="panel-body progress">
                  <div className="spread small">
                    <Money cents={data.emergency.balance_cents} className="strong" />
                    <span className="muted num">
                      of {fmt(data.emergency.target_cents)} · {emergencyPct}%
                    </span>
                  </div>
                  <div className="track" aria-hidden="true">
                    <div
                      className="fill"
                      style={{
                        width: `${Math.min(emergencyPct, 100)}%`,
                        background: 'var(--savings)',
                      }}
                    />
                  </div>
                </div>
              </section>
            </div>
          </div>

          <section className="panel">
            <PanelHead
              title="Last 6 cycles"
              icon={TrendingUp}
              subtitle="Income, spending and savings per pay cycle"
            />
            <div className="panel-body">
              {lineConfig && (
                <ChartCanvas
                  config={lineConfig}
                  label="Chart of income, spending and savings over the last 6 cycles"
                />
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
