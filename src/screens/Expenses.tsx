import { CalendarDays, Plus, Receipt } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getCycle, nextCycle, previousCycle } from '../../shared/finance';
import {
  PAYMENT_METHODS,
  type CycleRange,
  type EntryType,
  type Expense,
  type PaymentMethod,
} from '../../shared/types';
import { CategoryIcon } from '../components/CategoryIcon';
import {
  Badge,
  EmptyState,
  ErrorBox,
  LoadingPanels,
  Money,
  PeriodSwitcher,
  TypeBadge,
} from '../components/ui';
import { useApp } from '../lib/context';
import { useApi } from '../lib/hooks';
import { formatDay, formatShort, METHOD_LABEL } from '../lib/labels';

export function Expenses() {
  const { version, boot, today, activeCategories, categoryById, openSheet, isHidden, fmt } =
    useApp();
  const settings = boot!.settings;
  const [range, setRange] = useState<CycleRange>(() =>
    getCycle(today, settings.salary_day, settings.cycle_mode),
  );
  const [categoryId, setCategoryId] = useState('');
  const [type, setType] = useState<'' | EntryType>('');
  const [method, setMethod] = useState<'' | PaymentMethod>('');
  const [custom, setCustom] = useState(false);

  const params = new URLSearchParams({ from: range.start, to: range.end });
  if (categoryId) params.set('category_id', categoryId);
  if (type) params.set('type', type);
  if (method) params.set('payment_method', method);
  const { data, error, loading, reload } = useApi<{ expenses: Expense[] }>(
    `/api/expenses?${params}`,
    [version],
  );

  const groups = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const e of data?.expenses ?? []) {
      if (isHidden(`expense:${e.id}`)) continue;
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return [...map.entries()].map(([date, items]) => ({
      date,
      items,
      total: items.reduce((s, e) => s + e.amount_cents, 0),
    }));
  }, [data, isHidden]);

  const all = groups.flatMap((g) => g.items);
  const total = all.reduce((s, e) => s + e.amount_cents, 0);
  const needs = all.filter((e) => e.type === 'NEED').reduce((s, e) => s + e.amount_cents, 0);
  const isCurrent = range.start <= today && today <= range.end;
  const step = (dir: -1 | 1) => {
    setCustom(false);
    setRange((r) =>
      dir < 0
        ? previousCycle(r, settings.salary_day, settings.cycle_mode)
        : nextCycle(r, settings.salary_day, settings.cycle_mode),
    );
  };

  return (
    <div className="stack">
      <div className="toolbar">
        <PeriodSwitcher
          label={`${formatShort(range.start)} – ${formatShort(range.end)}`}
          sub={custom ? 'Custom range' : isCurrent ? 'Current cycle' : 'Pay cycle'}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
        />
        <div className="row">
          <button
            className={`btn ${custom ? '' : 'ghost'}`}
            onClick={() => setCustom((c) => !c)}
            aria-pressed={custom}
          >
            <CalendarDays size={16} /> Custom dates
          </button>
          <button className="btn primary" onClick={() => openSheet({ kind: 'expense' })}>
            <Plus size={17} /> Add expense
          </button>
        </div>
      </div>

      {custom && (
        <div className="panel panel-body form-grid" style={{ maxWidth: 480 }}>
          <div className="field">
            <label htmlFor="ex-from">From</label>
            <input
              id="ex-from"
              className="input"
              type="date"
              value={range.start}
              onChange={(e) => e.target.value && setRange((r) => ({ ...r, start: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="ex-to">To</label>
            <input
              id="ex-to"
              className="input"
              type="date"
              value={range.end}
              onChange={(e) => e.target.value && setRange((r) => ({ ...r, end: e.target.value }))}
            />
          </div>
        </div>
      )}

      <div className="stats four">
        <div className="stat">
          <div className="label">Total spent</div>
          <div className="value">{fmt(total)}</div>
        </div>
        <div className="stat">
          <div className="label">Needs</div>
          <div className="value">{fmt(needs)}</div>
        </div>
        <div className="stat">
          <div className="label">Wants</div>
          <div className="value">{fmt(total - needs)}</div>
        </div>
        <div className="stat">
          <div className="label">Transactions</div>
          <div className="value">{all.length}</div>
        </div>
      </div>

      <section className="panel">
        <div
          className="filters"
          aria-label="Filters"
          style={{ borderRadius: 'var(--radius) var(--radius) 0 0' }}
        >
          <select
            className="input"
            aria-label="Filter by category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">All categories</option>
            {activeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            className="input"
            aria-label="Filter by need or want"
            value={type}
            onChange={(e) => setType(e.target.value as '' | EntryType)}
          >
            <option value="">Needs and wants</option>
            <option value="NEED">Needs</option>
            <option value="WANT">Wants</option>
          </select>
          <select
            className="input"
            aria-label="Filter by payment method"
            value={method}
            onChange={(e) => setMethod(e.target.value as '' | PaymentMethod)}
          >
            <option value="">All payment methods</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {METHOD_LABEL[m]}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="panel-body">
            <ErrorBox message={error} onRetry={reload} />
          </div>
        )}
        {loading && !data ? (
          <div className="panel-body">
            <LoadingPanels count={2} />
          </div>
        ) : groups.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No expenses in this period"
            text={
              categoryId || type || method
                ? 'Try clearing the filters.'
                : 'Record your first expense – it takes a few seconds.'
            }
            action={
              <button className="btn primary" onClick={() => openSheet({ kind: 'expense' })}>
                <Plus size={16} /> Add expense
              </button>
            }
          />
        ) : (
          groups.map((g) => (
            <section key={g.date} className="group" aria-label={formatDay(g.date)}>
              <div className="group-head">
                <span>{g.date === today ? 'Today' : formatDay(g.date)}</span>
                <Money cents={g.total} />
              </div>
              <ul className="rows">
                {g.items.map((e) => {
                  const cat = categoryById(e.category_id);
                  return (
                    <li key={e.id}>
                      <button
                        className="item"
                        onClick={() => openSheet({ kind: 'expense', expense: e })}
                      >
                        <CategoryIcon icon={cat?.icon} name={cat?.name} color={cat?.color} />
                        <span className="grow" style={{ minWidth: 0 }}>
                          <span className="item-title ellipsis" style={{ display: 'block' }}>
                            {e.note || cat?.name || 'Expense'}
                          </span>
                          <span className="item-meta">
                            <TypeBadge type={e.type} />
                            <span>
                              {cat && e.note ? `${cat.name} · ` : ''}
                              {METHOD_LABEL[e.payment_method]}
                            </span>
                            {e.wishlist_item_id && <Badge tone="brand">Wishlist</Badge>}
                            {e.fixed_bill_id && <Badge tone="outline">Bill</Badge>}
                            {e.refund_of && <Badge tone="success">Refund</Badge>}
                            {e.refunded_cents ? (
                              <Badge tone="success">
                                {e.refunded_cents >= e.amount_cents
                                  ? 'Fully refunded'
                                  : 'Partly refunded'}
                              </Badge>
                            ) : null}
                          </span>
                        </span>
                        <Money
                          cents={e.amount_cents}
                          className={`item-amount ${e.amount_cents < 0 ? 'pos' : ''}`}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </section>
    </div>
  );
}
