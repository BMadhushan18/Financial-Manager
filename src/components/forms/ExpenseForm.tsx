import { ChevronDown, Info, Plus, Search, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CATALOG, matchCatalog, searchCatalog, type CatalogItem } from '../../../shared/catalog';
import { addDays, centsToInput, formatMoney, parseMoneyToCents } from '../../../shared/finance';
import {
  PAYMENT_METHODS,
  type EntryType,
  type Expense,
  type PaymentMethod,
} from '../../../shared/types';
import { api, errorMessage } from '../../lib/api';
import { useApp } from '../../lib/context';
import { useApi, useBusy } from '../../lib/hooks';
import { formatShort, METHOD_LABEL } from '../../lib/labels';
import { autoClassify } from '../../lib/quickAdd';
import { ItemThumb } from '../ItemThumb';
import { MoneyField, Sheet } from '../ui';

/** Everyday purchases shown before the user has any history. */
const STARTERS = [
  'bike-fuel',
  'weekly-groceries',
  'bus-fare',
  'tuk-tuk-ride',
  'medicine',
  'mobile-reload',
  'coffee',
  'restaurant-meal',
];

interface Pick {
  name: string;
  item?: CatalogItem;
  category_id: number | null;
  lastAmount?: number;
}

/** "What did you buy?" → amount → save. Edit mode adds refund + delete. */
export function ExpenseForm({
  expense,
  prefill,
  onClose,
}: {
  expense?: Expense;
  prefill?: { note: string; category_id: number | null };
  onClose: () => void;
}) {
  const app = useApp();
  const { activeCategories, categoryById, checkPurchase, toast, changed, today, confirm } = app;
  const editing = Boolean(expense);
  const isRefund = expense?.refund_of != null;
  const startNote = expense?.note ?? prefill?.note ?? '';
  const [amount, setAmount] = useState(
    centsToInput(expense ? Math.abs(expense.amount_cents) : null),
  );
  const [note, setNote] = useState(startNote);
  const [categoryId, setCategoryId] = useState<number | null>(
    expense?.category_id ?? prefill?.category_id ?? null,
  );
  const [picked, setPicked] = useState(Boolean(startNote || expense?.category_id));
  const [query, setQuery] = useState('');
  const [date, setDate] = useState(expense?.date ?? today);
  const [method, setMethod] = useState<PaymentMethod>(expense?.payment_method ?? 'cash');
  const [error, setError] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [showRefund, setShowRefund] = useState(false);
  const { busy, run } = useBusy();

  // Things this person buys often (last 90 days) become one-tap shortcuts.
  const history = useApi<{ expenses: Expense[] }>(
    editing ? null : `/api/expenses?from=${addDays(today, -90)}&to=${today}`,
    [],
  );
  const frequent = useMemo<Pick[]>(() => {
    const map = new Map<string, Pick & { count: number }>();
    for (const e of history.data?.expenses ?? []) {
      if (!e.note || e.refund_of || e.fixed_bill_id || e.amount_cents <= 0) continue;
      const key = e.note.trim().toLowerCase();
      const hit = map.get(key);
      if (hit) hit.count += 1;
      // list is newest first, so the first one seen holds the latest amount
      else
        map.set(key, {
          name: e.note.trim(),
          category_id: e.category_id,
          lastAmount: e.amount_cents,
          count: 1,
          item: matchCatalog(e.note),
        });
    }
    return [...map.values()]
      .filter((p) => p.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [history.data]);

  const shortcuts = useMemo<Pick[]>(() => {
    const out: Pick[] = [...frequent];
    for (const id of STARTERS) {
      if (out.length >= 8) break;
      const item = CATALOG.find((c) => c.id === id);
      if (!item || out.some((p) => p.name.toLowerCase() === item.name.toLowerCase())) continue;
      out.push({
        name: item.name,
        item,
        category_id: autoClassify(item.name, activeCategories, item).category?.id ?? null,
      });
    }
    return out;
  }, [frequent, activeCategories]);

  const suggestions = useMemo<Pick[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const fromHistory = frequent.filter((p) => p.name.toLowerCase().includes(q));
    const fromCatalog = searchCatalog(q, 6)
      .filter((c) => !fromHistory.some((p) => p.name.toLowerCase() === c.name.toLowerCase()))
      .map((item) => ({
        name: item.name,
        item,
        category_id: autoClassify(item.name, activeCategories, item).category?.id ?? null,
      }));
    return [...fromHistory, ...fromCatalog].slice(0, 6);
  }, [query, frequent, activeCategories]);

  const choose = (p: Pick) => {
    setNote(p.name);
    setCategoryId(
      p.category_id ?? autoClassify(p.name, activeCategories, p.item).category?.id ?? null,
    );
    if (p.lastAmount && !amount) setAmount(centsToInput(p.lastAmount));
    setPicked(true);
    setQuery('');
    setError(null);
  };

  const chooseTyped = () => {
    const text = query.trim();
    if (!text) return;
    choose({ name: text, category_id: autoClassify(text, activeCategories).category?.id ?? null });
  };

  const category = categoryById(categoryId);

  const save = () =>
    run(async () => {
      const cents = parseMoneyToCents(amount);
      if (cents === null || cents <= 0) {
        setError('Please enter the amount.');
        return;
      }
      let finalNote = note.trim();
      let finalCategory = categoryId;
      if (!picked && query.trim()) {
        finalNote = query.trim();
        finalCategory = autoClassify(finalNote, activeCategories).category?.id ?? null;
      }
      if (!finalNote && !finalCategory && !editing) {
        setError('Tell us what you bought – type it or tap one of the items.');
        return;
      }
      if (!finalCategory && !editing) {
        finalCategory = activeCategories.find((c) => c.name === 'Other')?.id ?? null;
      }
      setError(null);
      const cat = categoryById(finalCategory);
      const type: EntryType = cat?.type ?? autoClassify(finalNote, activeCategories).type;
      const body = {
        amount_cents: cents,
        category_id: finalCategory,
        type,
        date,
        payment_method: method,
        note: finalNote || null,
      };
      try {
        if (editing && expense) {
          await api(`/api/expenses/${expense.id}`, { method: 'PUT', body });
          toast({ message: 'Expense updated.' });
          changed();
          onClose();
          return;
        }
        // Gentle check for wants only.
        const choice =
          type === 'WANT'
            ? await checkPurchase({ amount_cents: cents, type: 'WANT', category_id: finalCategory })
            : 'buy';
        if (choice === 'cancel') return;
        if (choice === 'buy') {
          const res = await api<{ expense: Expense }>('/api/expenses', { method: 'POST', body });
          toast({
            message: `Saved ${formatMoney(cents, app.currency)}${finalNote ? ` · ${finalNote}` : ''}`,
            actionLabel: 'Undo',
            onAction: () => {
              api(`/api/expenses/${res.expense.id}`, { method: 'DELETE' })
                .then(changed)
                .catch((e) => toast({ message: errorMessage(e), tone: 'error' }));
            },
          });
        } else {
          const cooling = app.boot?.settings.cooling_days ?? 7;
          const reminder = choice === 'remind' ? addDays(today, cooling) : null;
          const res = await api<{ item: { id: number } }>('/api/wishlist', {
            method: 'POST',
            body: {
              name: finalNote || cat?.name || 'Purchase',
              category_id: finalCategory,
              type: 'WANT',
              estimated_cents: cents,
              urgency: 'THIS_MONTH',
              reminder_date: reminder,
            },
          });
          if (choice === 'next_month') {
            await api(`/api/wishlist/${res.item.id}/plan`, {
              method: 'POST',
              body: { cycle: 'next' },
            });
            toast({ message: 'Saved to your wishlist for next month. Nothing was spent.' });
          } else {
            toast({ message: `Saved to your wishlist. Reminder on ${formatShort(reminder!)}.` });
          }
        }
        changed();
        onClose();
      } catch (e) {
        setError(errorMessage(e));
      }
    });

  const remove = async () => {
    if (!expense) return;
    if (expense.wishlist_item_id) {
      const ok = await confirm({
        title: 'Delete this purchase?',
        message:
          'This expense came from your wishlist. Deleting it moves the item back to your list.',
        confirmLabel: 'Delete',
        danger: true,
      });
      if (!ok) return;
    }
    onClose();
    app.deferDelete(
      `expense:${expense.id}`,
      isRefund ? 'Refund deleted.' : 'Expense deleted.',
      () => api(`/api/expenses/${expense.id}`, { method: 'DELETE', keepalive: true }),
    );
  };

  const refund = () =>
    run(async () => {
      if (!expense) return;
      const cents = parseMoneyToCents(refundAmount);
      if (cents === null || cents <= 0) {
        setError('Please enter the refund amount.');
        return;
      }
      try {
        await api(`/api/expenses/${expense.id}/refund`, {
          method: 'POST',
          body: { amount_cents: cents, date: today },
        });
        toast({ message: `Refund of ${formatMoney(cents, app.currency)} recorded.` });
        changed();
        onClose();
      } catch (e) {
        setError(errorMessage(e));
      }
    });

  const title = isRefund ? 'Edit refund' : editing ? 'Edit expense' : 'New expense';
  return (
    <Sheet title={title} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {!isRefund && (
          <div className="field">
            <span className="label">What did you buy?</span>
            {picked ? (
              <div className="picked">
                <ItemThumb name={note} category={category} size={44} />
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="item-title ellipsis" style={{ display: 'block' }}>
                    {note || category?.name || 'Expense'}
                  </span>
                  <span className="item-meta">{category?.name ?? 'Other'}</span>
                </span>
                <button
                  type="button"
                  className="btn sm ghost"
                  onClick={() => {
                    setPicked(false);
                    setQuery('');
                  }}
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <div className="search-box">
                  <Search size={18} className="search-icon" aria-hidden="true" />
                  <input
                    className="search-input"
                    aria-label="What did you buy?"
                    placeholder="Type it… e.g. fuel, rice, bus"
                    value={query}
                    autoFocus
                    autoComplete="off"
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && query.trim()) {
                        e.preventDefault();
                        const first = suggestions[0];
                        if (first) choose(first);
                        else chooseTyped();
                      }
                    }}
                  />
                </div>
                {query.trim() ? (
                  <div className="stack-sm" style={{ gap: 2 }}>
                    {suggestions.map((p) => (
                      <div key={p.name} className="result">
                        <button type="button" className="result-main" onClick={() => choose(p)}>
                          <ItemThumb name={p.name} item={p.item} size={38} />
                          <span className="grow">
                            <span className="item-title">{p.name}</span>
                            <span className="item-meta">
                              {p.lastAmount
                                ? `Last time ${app.fmt(p.lastAmount)}`
                                : (p.item?.category ?? '')}
                            </span>
                          </span>
                        </button>
                      </div>
                    ))}
                    <div className="result">
                      <button type="button" className="result-main" onClick={chooseTyped}>
                        <span className="tile" style={{ width: 38, height: 38 }}>
                          <Plus size={16} />
                        </span>
                        <span className="item-title">Use “{query.trim()}”</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="tiles"
                    role="group"
                    aria-label={frequent.length ? 'Your frequent purchases' : 'Common purchases'}
                  >
                    {shortcuts.map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        className="tile-card"
                        onClick={() => choose(p)}
                      >
                        <ItemThumb
                          name={p.name}
                          item={p.item}
                          category={categoryById(p.category_id)}
                          size={52}
                        />
                        <span>{p.name}</span>
                        {p.lastAmount ? <small>{app.fmt(p.lastAmount)}</small> : null}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <MoneyField
          label={isRefund ? 'Refund amount' : 'How much?'}
          value={amount}
          onChange={setAmount}
          autoFocus={picked && !editing}
          big
        />

        {(expense?.wishlist_item_id || expense?.fixed_bill_id) && (
          <div className="callout info">
            <Info size={16} />
            <span>
              {expense.wishlist_item_id
                ? 'This came from your wishlist. Changes here also update the wishlist item.'
                : 'This is a bill payment. Changes also update the bill for that cycle.'}
            </span>
          </div>
        )}

        <details className="more" open={editing}>
          <summary>
            Date, payment and category <ChevronDown size={16} />
          </summary>
          <div className="stack" style={{ marginTop: 12 }}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="exp-date">Date</label>
                <input
                  id="exp-date"
                  className="input"
                  type="date"
                  value={date}
                  max="9999-12-31"
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="exp-method">Paid by</label>
                <select
                  id="exp-method"
                  className="input"
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {METHOD_LABEL[m]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {!isRefund && (
              <div className="field">
                <label htmlFor="exp-cat">Category</label>
                <select
                  id="exp-cat"
                  className="input"
                  value={categoryId ?? ''}
                  onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Choose automatically</option>
                  {activeCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </details>

        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}

        <button className="btn primary lg block" type="submit" disabled={busy}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Save expense'}
        </button>

        {editing && expense && (
          <div className="stack-sm">
            {!isRefund && expense.amount_cents > 0 && (
              <>
                {!showRefund ? (
                  <button type="button" className="btn block" onClick={() => setShowRefund(true)}>
                    <Undo2 size={16} /> Record a refund
                  </button>
                ) : (
                  <div
                    className="panel panel-body stack-sm"
                    style={{ background: 'var(--surface-2)' }}
                  >
                    <MoneyField
                      label="Refund amount"
                      value={refundAmount}
                      onChange={setRefundAmount}
                      hint={
                        expense.refunded_cents
                          ? `Already refunded: ${app.fmt(expense.refunded_cents)}`
                          : 'Money you got back'
                      }
                    />
                    <button
                      type="button"
                      className="btn"
                      onClick={() => void refund()}
                      disabled={busy}
                    >
                      Save refund
                    </button>
                  </div>
                )}
              </>
            )}
            <button type="button" className="btn danger-ghost block" onClick={() => void remove()}>
              Delete {isRefund ? 'refund' : 'expense'}
            </button>
          </div>
        )}
      </form>
    </Sheet>
  );
}
