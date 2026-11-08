import { useMemo, useState } from 'react';
import { getCycle, nextCycle, previousCycle } from '../../shared/finance';
import {
  PAYMENT_METHODS,
  type CycleRange,
  type EntryType,
  type Expense,
  type PaymentMethod,
} from '../../shared/types';
import { Icon } from '../components/Icon';
import { EmptyState, ErrorBox, LoadingCards, Money, TypeTag } from '../components/ui';
import { useApp } from '../lib/context';
import { useApi } from '../lib/hooks';
import { formatDay, formatShort, METHOD_LABEL } from '../lib/labels';

export function Expenses() {
  const { version, boot, today, activeCategories, categoryById, openSheet, isHidden } = useApp();
  const settings = boot!.settings;
  const [range, setRange] = useState<CycleRange>(() =>
    getCycle(today, settings.salary_day, settings.cycle_mode),
  );
  const [categoryId, setCategoryId] = useState('');
  const [type, setType] = useState<'' | EntryType>('');
  const [method, setMethod] = useState<'' | PaymentMethod>('');

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

  const total = groups.reduce((s, g) => s + g.total, 0);
  const isCurrent = range.start <= today && today <= range.end;
  const step = (dir: -1 | 1) =>
    setRange((r) =>
      dir < 0
        ? previousCycle(r, settings.salary_day, settings.cycle_mode)
        : nextCycle(r, settings.salary_day, settings.cycle_mode),
    );

  return (
    <div className="stack">
      <div className="card flat spread" style={{ padding: 8 }}>
        <button className="icon-btn" onClick={() => step(-1)} aria-label="Previous cycle">
          <Icon name="left" />
        </button>
        <div style={{ textAlign: 'center' }}>
          <strong>
            {formatShort(range.start)} – {formatShort(range.end)}
          </strong>
          <div className="tiny muted">{isCurrent ? 'This cycle' : 'Past or future cycle'}</div>
        </div>
        <button className="icon-btn" onClick={() => step(1)} aria-label="Next cycle">
          <Icon name="right" />
        </button>
      </div>

      <div className="filters" aria-label="Filters">
        <select
          className="input"
          aria-label="Filter by category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">All categories</option>
          {activeCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
        <select
          className="input"
          aria-label="Filter by need or want"
          value={type}
          onChange={(e) => setType(e.target.value as '' | EntryType)}
        >
          <option value="">Needs & wants</option>
          <option value="NEED">● Needs</option>
          <option value="WANT">★ Wants</option>
        </select>
        <select
          className="input"
          aria-label="Filter by payment method"
          value={method}
          onChange={(e) => setMethod(e.target.value as '' | PaymentMethod)}
        >
          <option value="">Any payment</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {METHOD_LABEL[m]}
            </option>
          ))}
        </select>
      </div>
      <details className="more">
        <summary>Custom dates</summary>
        <div className="grid-2" style={{ marginTop: 8 }}>
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
      </details>

      {groups.length > 0 && (
        <div className="spread small">
          <span className="muted">Total for this view</span>
          <strong>
            <Money cents={total} />
          </strong>
        </div>
      )}

      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data ? (
        <LoadingCards count={3} />
      ) : groups.length === 0 ? (
        <div className="card">
          <EmptyState
            emoji="🧾"
            title="No expenses here"
            text={
              categoryId || type || method
                ? 'Try clearing the filters.'
                : 'Tap + to add one – it takes 5 seconds.'
            }
            action={
              <button className="btn primary" onClick={() => openSheet({ kind: 'expense' })}>
                Add expense
              </button>
            }
          />
        </div>
      ) : (
        <div>
          {groups.map((g) => (
            <section key={g.date} aria-label={formatDay(g.date)}>
              <div className="day-head">
                <span>{g.date === today ? 'Today' : formatDay(g.date)}</span>
                <Money cents={g.total} />
              </div>
              <div className="card" style={{ padding: '4px 12px' }}>
                <ul className="list">
                  {g.items.map((e) => {
                    const cat = categoryById(e.category_id);
                    return (
                      <li key={e.id}>
                        <button
                          className="list-btn"
                          onClick={() => openSheet({ kind: 'expense', expense: e })}
                        >
                          <span className="icon-dot" aria-hidden="true">
                            {e.refund_of ? '↩️' : (cat?.icon ?? '🏷️')}
                          </span>
                          <span className="grow">
                            <span className="ellipsis" style={{ display: 'block' }}>
                              {e.note || cat?.name || 'Expense'}
                            </span>
                            <span className="row wrap tiny muted" style={{ gap: 4 }}>
                              <TypeTag type={e.type} />
                              {cat && e.note ? cat.name : null}
                              {' · '}
                              {METHOD_LABEL[e.payment_method]}
                              {e.wishlist_item_id && (
                                <span className="tag primary">💜 Wishlist</span>
                              )}
                              {e.fixed_bill_id && <span className="tag neutral">🧾 Bill</span>}
                              {e.refund_of && <span className="tag save">Refund</span>}
                              {e.refunded_cents ? (
                                <span className="tag save">
                                  {e.refunded_cents >= e.amount_cents
                                    ? 'Fully refunded'
                                    : 'Partly refunded'}
                                </span>
                              ) : null}
                            </span>
                          </span>
                          <Money
                            cents={e.amount_cents}
                            className={e.amount_cents < 0 ? 'positive' : ''}
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
