import { useMemo, useState } from 'react';
import {
  itemTotalCents,
  priorityLabel,
  priorityScore,
  sortWishes,
  type WishSort,
} from '../../shared/finance';
import { URGENCIES, type EntryType, type Urgency, type WishlistItem } from '../../shared/types';
import { EmptyState, ErrorBox, LoadingCards } from '../components/ui';
import { WishCard } from '../components/WishCard';
import { useApp } from '../lib/context';
import { readLocal, useApi, writeLocal } from '../lib/hooks';
import { URGENCY_LABEL } from '../lib/labels';

type Tab = 'ideas' | 'month' | 'bought' | 'dropped';
const TABS: { id: Tab; label: string }[] = [
  { id: 'ideas', label: 'All ideas' },
  { id: 'month', label: 'This month' },
  { id: 'bought', label: 'Bought' },
  { id: 'dropped', label: 'Dropped' },
];

export function Wishlist() {
  const { version, cycle, today, activeCategories, openSheet, fmt } = useApp();
  const { data, error, loading, reload } = useApi<{ items: WishlistItem[] }>('/api/wishlist', [
    version,
  ]);
  const [tab, setTab] = useState<Tab>(() => (readLocal('mm-wish-tab', 'ideas') as Tab) || 'ideas');
  const [type, setType] = useState<'' | EntryType>('');
  const [categoryId, setCategoryId] = useState('');
  const [urgency, setUrgency] = useState<'' | Urgency>('');
  const [sort, setSort] = useState<WishSort>('score');

  const cycleStart = cycle?.cycle.start ?? '';
  const safe = cycle?.safe_to_spend_cents ?? 0;

  const list = useMemo(() => {
    const items = data?.items ?? [];
    const filtered = items.filter((i) => {
      if (tab === 'ideas' && i.status !== 'IDEA' && i.status !== 'PLANNED') return false;
      if (tab === 'month' && !(i.status === 'PLANNED' && i.target_cycle === cycleStart))
        return false;
      if (tab === 'bought' && i.status !== 'BOUGHT') return false;
      if (tab === 'dropped' && i.status !== 'DROPPED') return false;
      if (type && i.type !== type) return false;
      if (categoryId && String(i.category_id) !== categoryId) return false;
      if (urgency && i.urgency !== urgency) return false;
      return true;
    });
    const scored = filtered.map((item) => {
      const score = priorityScore(item, { safeToSpendCents: safe, today, cycleStart }).score;
      return { item, score, label: priorityLabel(score) };
    });
    if (tab === 'bought' || tab === 'dropped') {
      return [...scored].sort((a, b) =>
        (b.item.bought_at ?? b.item.dropped_at ?? '').localeCompare(
          a.item.bought_at ?? a.item.dropped_at ?? '',
        ),
      );
    }
    return sortWishes(scored, sort);
  }, [data, tab, type, categoryId, urgency, sort, safe, today, cycleStart]);

  const counts = useMemo(() => {
    const items = data?.items ?? [];
    return {
      ideas: items.filter((i) => i.status === 'IDEA' || i.status === 'PLANNED').length,
      month: items.filter((i) => i.status === 'PLANNED' && i.target_cycle === cycleStart).length,
      bought: items.filter((i) => i.status === 'BOUGHT').length,
      dropped: items.filter((i) => i.status === 'DROPPED').length,
    };
  }, [data, cycleStart]);

  const total = list.reduce(
    (s, w) =>
      s + (w.item.status === 'BOUGHT' ? (w.item.actual_cents ?? 0) : itemTotalCents(w.item)),
    0,
  );
  const showScore = tab === 'ideas' || tab === 'month';

  return (
    <div className="stack">
      <div className="tabs" role="tablist" aria-label="Wishlist sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id);
              writeLocal('mm-wish-tab', t.id);
            }}
          >
            {t.label} <span className="muted">({counts[t.id]})</span>
          </button>
        ))}
      </div>

      <div className="filters" aria-label="Filters">
        <select
          className="input"
          aria-label="Filter by need or want"
          value={type}
          onChange={(e) => setType(e.target.value as '' | EntryType)}
        >
          <option value="">Needs & wants</option>
          <option value="NEED">● Needs only</option>
          <option value="WANT">★ Wants only</option>
        </select>
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
          aria-label="Filter by urgency"
          value={urgency}
          onChange={(e) => setUrgency(e.target.value as '' | Urgency)}
        >
          <option value="">Any urgency</option>
          {URGENCIES.map((u) => (
            <option key={u} value={u}>
              {URGENCY_LABEL[u]}
            </option>
          ))}
        </select>
        {showScore && (
          <select
            className="input"
            aria-label="Sort by"
            value={sort}
            onChange={(e) => setSort(e.target.value as WishSort)}
          >
            <option value="score">Sort: priority</option>
            <option value="price">Sort: price</option>
            <option value="date">Sort: newest</option>
          </select>
        )}
      </div>

      {list.length > 0 && (
        <p className="small muted">
          {list.length} {list.length === 1 ? 'item' : 'items'} ·{' '}
          {tab === 'dropped' ? 'money saved' : tab === 'bought' ? 'spent' : 'total'}{' '}
          <strong>{fmt(total)}</strong>
          {showScore && ' · Score = need, urgency, your priority and whether it fits this month'}
        </p>
      )}

      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data ? (
        <LoadingCards count={4} />
      ) : list.length === 0 ? (
        <div className="card">
          <EmptyState
            emoji={
              tab === 'bought' ? '🛍️' : tab === 'dropped' ? '🍃' : tab === 'month' ? '🗓️' : '💜'
            }
            title={
              tab === 'month'
                ? 'Nothing planned this month'
                : tab === 'bought'
                  ? 'Nothing bought yet'
                  : tab === 'dropped'
                    ? 'No dropped wishes'
                    : 'No wishes here'
            }
            text={
              tab === 'month'
                ? 'Pick ideas and tap "Plan this month" to set their price aside.'
                : tab === 'dropped'
                  ? 'Dropping a want you no longer need counts as money saved.'
                  : 'Add anything you want to buy – only the name is needed.'
            }
            action={
              tab === 'ideas' ? (
                <button className="btn primary" onClick={() => openSheet({ kind: 'wish' })}>
                  Add a wish
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {list.map((w) => (
            <WishCard
              key={w.item.id}
              item={w.item}
              score={showScore ? w.score : undefined}
              label={showScore ? w.label : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
