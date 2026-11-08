import { Check, Plus, Search, ShoppingBag, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CATALOG, searchCatalog, type CatalogItem } from '../../shared/catalog';
import type { WishlistItem } from '../../shared/types';
import { useApp } from '../lib/context';
import { useApi } from '../lib/hooks';
import { autoClassify, useQuickAdd } from '../lib/quickAdd';
import { ItemThumb } from './ItemThumb';

const POPULAR = [
  'running-shoes',
  'smartphone',
  'headphones',
  'rice-cooker',
  'laptop',
  'wristwatch',
  'smartwatch',
  'weekend-trip',
];

type Row =
  | { kind: 'listed'; wish: WishlistItem }
  | { kind: 'catalog'; item: CatalogItem }
  | { kind: 'custom'; name: string };

/**
 * "Search or add an item" box. Typing shows real items with photos; one tap
 * (or Enter) adds to the wishlist with category and need/want chosen
 * automatically. `inline` shows results below instead of as a dropdown.
 */
export function QuickSearch({
  inline,
  autoFocus,
  onAdded,
}: {
  inline?: boolean;
  autoFocus?: boolean;
  onAdded?: () => void;
}) {
  const { version, openSheet, activeCategories } = useApp();
  const quickAdd = useQuickAdd();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(Boolean(inline));
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(Boolean(inline || autoFocus));
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const wishes = useApi<{ items: WishlistItem[] }>(touched ? '/api/wishlist' : null, [version]);

  const rows = useMemo<Row[]>(() => {
    const query = q.trim();
    if (!query) return [];
    const lower = query.toLowerCase();
    const activeWishes = (wishes.data?.items ?? []).filter(
      (w) => w.status === 'IDEA' || w.status === 'PLANNED',
    );
    const listed = activeWishes.filter((w) => w.name.toLowerCase().includes(lower)).slice(0, 3);
    const listedNames = new Set(listed.map((w) => w.name.toLowerCase()));
    const catalog = searchCatalog(query, 6).filter((c) => !listedNames.has(c.name.toLowerCase()));
    // An exact match already on the list comes first (prevents duplicates);
    // otherwise catalogue suggestions lead and partial list matches follow.
    const exactListed = listed.filter((w) => w.name.toLowerCase() === lower);
    const otherListed = listed.filter((w) => w.name.toLowerCase() !== lower);
    const out: Row[] = [
      ...exactListed.map((wish) => ({ kind: 'listed' as const, wish })),
      ...catalog.map((item) => ({ kind: 'catalog' as const, item })),
      ...otherListed.map((wish) => ({ kind: 'listed' as const, wish })),
    ];
    const exact = catalog.some((c) => c.name.toLowerCase() === lower) || listedNames.has(lower);
    if (!exact) out.push({ kind: 'custom', name: query });
    return out;
  }, [q, wishes.data]);

  useEffect(() => setActive(0), [q]);

  // Close the dropdown when clicking elsewhere.
  useEffect(() => {
    if (inline || !open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [inline, open]);

  const add = async (name: string, item?: CatalogItem) => {
    if (busy) return;
    setBusy(true);
    const created = await quickAdd(name, item);
    setBusy(false);
    if (created) {
      setQ('');
      onAdded?.();
      input.current?.focus();
    }
  };

  const bought = (name: string, item?: CatalogItem) => {
    const { category } = autoClassify(name, activeCategories, item);
    setQ('');
    setOpen(Boolean(inline));
    openSheet({
      kind: 'expense',
      prefill: { note: item?.name ?? name, category_id: category?.id ?? null },
    });
  };

  const choose = (row: Row) => {
    if (row.kind === 'listed') {
      setOpen(Boolean(inline));
      setQ('');
      openSheet({ kind: 'wish', item: row.wish });
    } else if (row.kind === 'catalog') void add(row.item.name, row.item);
    else void add(row.name);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = rows[active];
      if (row) choose(row);
    } else if (e.key === 'Escape') {
      setQ('');
      if (!inline) setOpen(false);
    }
  };

  const showPanel = open && (rows.length > 0 || (inline && !q.trim()));
  const popular = POPULAR.map((id) => CATALOG.find((c) => c.id === id)).filter(
    (c): c is CatalogItem => Boolean(c),
  );

  return (
    <div className={`search ${inline ? 'inline' : ''}`} ref={wrap}>
      <div className="search-box">
        <Search size={18} className="search-icon" aria-hidden="true" />
        <input
          ref={input}
          className="search-input"
          type="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label="Search or add an item to your wishlist"
          placeholder="Search or add an item… e.g. shoes, rice, laptop"
          autoComplete="off"
          autoFocus={autoFocus}
          value={q}
          onFocus={() => {
            setTouched(true);
            setOpen(true);
          }}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKey}
        />
        {q && (
          <button
            className="icon-btn sm"
            type="button"
            aria-label="Clear search"
            onClick={() => setQ('')}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {showPanel && (
        <div className="search-panel" id={listId} role="listbox" aria-label="Suggestions">
          {!q.trim() && inline ? (
            <>
              <p className="search-label">Popular wishes – tap to add</p>
              <div className="tiles">
                {popular.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="tile-card"
                    onClick={() => void add(item.name, item)}
                  >
                    <ItemThumb item={item} size={64} />
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            rows.map((row, i) => {
              const selected = i === active;
              if (row.kind === 'listed') {
                return (
                  <div
                    key={`l${row.wish.id}`}
                    className={`result ${selected ? 'active' : ''}`}
                    role="option"
                    aria-selected={selected}
                  >
                    <button type="button" className="result-main" onClick={() => choose(row)}>
                      <ItemThumb name={row.wish.name} size={40} />
                      <span className="grow">
                        <span className="item-title">{row.wish.name}</span>
                        <span className="item-meta">Already on your list – tap to open</span>
                      </span>
                    </button>
                    <span className="badge success">
                      <Check size={12} /> On list
                    </span>
                  </div>
                );
              }
              const name = row.kind === 'catalog' ? row.item.name : row.name;
              const item = row.kind === 'catalog' ? row.item : undefined;
              return (
                <div
                  key={row.kind === 'catalog' ? row.item.id : 'custom'}
                  className={`result ${selected ? 'active' : ''}`}
                  role="option"
                  aria-selected={selected}
                >
                  <button
                    type="button"
                    className="result-main"
                    onClick={() => choose(row)}
                    disabled={busy}
                  >
                    {item ? (
                      <ItemThumb item={item} size={40} />
                    ) : (
                      <span className="tile" style={{ width: 40, height: 40 }}>
                        <Plus size={18} />
                      </span>
                    )}
                    <span className="grow">
                      <span className="item-title">{item ? name : `Add “${name}”`}</span>
                      <span className="item-meta">
                        {item ? item.category : 'Add exactly what you typed'}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="icon-btn sm"
                    title="I already bought it – record the expense"
                    aria-label={`I bought ${name}`}
                    onClick={() => bought(name, item)}
                  >
                    <ShoppingBag size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn sm primary"
                    onClick={() => choose(row)}
                    disabled={busy}
                  >
                    <Plus size={15} /> Add
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
