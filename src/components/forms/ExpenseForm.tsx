import { ChevronDown, Info, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  addDays,
  centsToInput,
  formatMoney,
  parseMoneyToCents,
  suggestType,
} from '../../../shared/finance';
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
import { MoneyField, Sheet } from '../ui';

interface Recent {
  name: string;
  category_id: number | null;
  lastAmount: number;
  count: number;
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
  const [amount, setAmount] = useState(
    centsToInput(expense ? Math.abs(expense.amount_cents) : null),
  );
  const [note, setNote] = useState(expense?.note ?? prefill?.note ?? '');
  const [categoryId, setCategoryId] = useState<number | null>(
    expense?.category_id ?? prefill?.category_id ?? null,
  );
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
  const recent = useMemo<Recent[]>(() => {
    const map = new Map<string, Recent>();
    for (const e of history.data?.expenses ?? []) {
      if (!e.note || e.refund_of || e.fixed_bill_id || e.amount_cents <= 0) continue;
      const key = e.note.trim().toLowerCase();
      const hit = map.get(key);
      if (hit) hit.count += 1;
      // newest first, so the first one seen holds the latest amount and category
      else
        map.set(key, {
          name: e.note.trim(),
          category_id: e.category_id,
          lastAmount: e.amount_cents,
          count: 1,
        });
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  }, [history.data]);

  const pick = (r: Recent) => {
    setNote(r.name);
    setCategoryId(r.category_id);
    if (!amount) setAmount(centsToInput(r.lastAmount));
    setError(null);
  };

  const save = () =>
    run(async () => {
      const cents = parseMoneyToCents(amount);
      if (cents === null || cents <= 0) {
        setError('Please enter the amount.');
        return;
      }
      const finalNote = note.trim();
      if (!finalNote && !editing) {
        setError('Please write what you bought.');
        return;
      }
      // Category: chosen, or the one used last time for the same thing, or "Other".
      let finalCategory = categoryId;
      if (finalCategory === null && !editing) {
        const same = recent.find((r) => r.name.toLowerCase() === finalNote.toLowerCase());
        finalCategory =
          same?.category_id ?? activeCategories.find((c) => c.name === 'Other')?.id ?? null;
      }
      setError(null);
      const cat = categoryById(finalCategory);
      const type: EntryType =
        cat && cat.name !== 'Other' ? cat.type : suggestType(finalNote, null).type;
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
        const choice =
          type === 'WANT'
            ? await checkPurchase({ amount_cents: cents, type: 'WANT', category_id: finalCategory })
            : 'buy';
        if (choice === 'cancel') return;
        if (choice === 'buy') {
          const res = await api<{ expense: Expense }>('/api/expenses', { method: 'POST', body });
          toast({
            message: `Saved ${formatMoney(cents, app.currency)} · ${finalNote}`,
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
              name: finalNote,
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
            <label htmlFor="exp-note">What did you buy?</label>
            <input
              id="exp-note"
              className="input"
              value={note}
              maxLength={200}
              autoFocus={!editing && !prefill}
              autoComplete="off"
              placeholder="e.g. Bike fuel, groceries, bus"
              onChange={(e) => setNote(e.target.value)}
            />
            {!editing && recent.length > 0 && (
              <div className="shortcuts" role="group" aria-label="Your frequent purchases">
                {recent.map((r) => (
                  <button key={r.name} type="button" className="shortcut" onClick={() => pick(r)}>
                    {r.name} <small>{app.fmt(r.lastAmount)}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <MoneyField
          label={isRefund ? 'Refund amount' : 'How much?'}
          value={amount}
          onChange={setAmount}
          autoFocus={Boolean(prefill)}
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
                  <option value="">Automatic</option>
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
