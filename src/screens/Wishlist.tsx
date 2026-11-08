import { CalendarCheck, Heart, Leaf, Plus, ShoppingBag, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  itemTotalCents,
  priorityLabel,
  priorityScore,
  sortWishes,
  type WishSort,
} from '../../shared/finance';
import { URGENCIES, type EntryType, type Urgency, type WishlistItem } from '../../shared/types';
import { QuickSearch } from '../components/QuickSearch';
import { EmptyState, ErrorBox, LoadingPanels } from '../components/ui';
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
  const [showFilters, setShowFilters] = useState(false);

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
  const totalLabel =
    tab === 'dropped' ? 'Money saved' : tab === 'bought' ? 'Total spent' : 'Estimated total';
  const emptyIcon =
    tab === 'bought'
      ? ShoppingBag
      : tab === 'dropped'
        ? Leaf
        : tab === 'month'
          ? CalendarCheck
          : Heart;

  return (
    <div className="stack">
      <div className="hide-desktop">
        <QuickSearch />
      </div>

      <section className="panel">
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
              {t.label}
              <span className="count">{counts[t.id]}</span>
            </button>
          ))}
        </div>

        <div
          className="spread"
          style={{ padding: '8px 20px', borderBottom: '1px solid var(--border)' }}
        >
          <span className="small muted">
            {showScore
              ? 'Most important first'
              : tab === 'bought'
                ? 'Newest purchases first'
                : 'Most recent first'}
          </span>
          <button
            type="button"
            className={`btn sm ${showFilters ? '' : 'ghost'}`}
            aria-expanded={showFilters}
            onClick={() => setShowFilters((v) => !v)}
          >
            <SlidersHorizontal size={15} /> Filter
          </button>
        </div>
        {showFilters && (
          <div className="filters" aria-label="Filters">
            <select
              className="input"
              aria-label="Filter by need or want"
              value={type}
              onChange={(e) => setType(e.target.value as '' | EntryType)}
            >
              <option value="">Needs and wants</option>
              <option value="NEED">Needs only</option>
              <option value="WANT">Wants only</option>
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
                  {c.name}
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
                <option value="score">Sort by priority</option>
                <option value="price">Sort by price</option>
                <option value="date">Sort by newest</option>
              </select>
            )}
          </div>
        )}

        {error && (
          <div className="panel-body">
            <ErrorBox message={error} onRetry={reload} />
          </div>
        )}
        {loading && !data ? (
          <div className="panel-body">
            <LoadingPanels count={2} />
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={emptyIcon}
            title={
              tab === 'month'
                ? 'Nothing planned for this month'
                : tab === 'bought'
                  ? 'No purchases yet'
                  : tab === 'dropped'
                    ? 'No dropped items'
                    : 'No items here'
            }
            text={
              tab === 'month'
                ? 'Use ⋯ on an item and choose "Plan for this month" to set money aside for it.'
                : tab === 'dropped'
                  ? 'Dropping a want you no longer need counts as money saved.'
                  : 'Search above and tap Add – that is all.'
            }
            action={
              tab === 'ideas' ? (
                <button className="btn primary" onClick={() => openSheet({ kind: 'wish' })}>
                  <Plus size={16} /> Add item
                </button>
              ) : undefined
            }
          />
        ) : (
          <div>
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

        {list.length > 0 && (
          <div className="panel-foot spread small">
            <span className="muted">
              {list.length} {list.length === 1 ? 'item' : 'items'}
              {showScore && ' · score = need + urgency + your priority + fits this month'}
            </span>
            <span>
              <span className="muted">{totalLabel} </span>
              <strong className="num">{fmt(total)}</strong>
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
