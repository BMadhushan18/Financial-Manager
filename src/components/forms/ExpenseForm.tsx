import { useState } from 'react';
import { addDays, centsToInput, formatMoney, parseMoneyToCents } from '../../../shared/finance';
import {
  PAYMENT_METHODS,
  type EntryType,
  type Expense,
  type PaymentMethod,
} from '../../../shared/types';
import { api, errorMessage } from '../../lib/api';
import { useApp } from '../../lib/context';
import { useBusy } from '../../lib/hooks';
import { formatShort, METHOD_LABEL } from '../../lib/labels';
import { MoneyField, Segmented, Sheet, TypeTag } from '../ui';

/** Quick add (amount → category → save) and edit, with refund + delete. */
export function ExpenseForm({ expense, onClose }: { expense?: Expense; onClose: () => void }) {
  const app = useApp();
  const { activeCategories, categoryById, checkPurchase, toast, changed, today, confirm } = app;
  const editing = Boolean(expense);
  const isRefund = expense?.refund_of != null;
  const [amount, setAmount] = useState(
    centsToInput(expense ? Math.abs(expense.amount_cents) : null),
  );
  const [categoryId, setCategoryId] = useState<number | null>(expense?.category_id ?? null);
  const [type, setType] = useState<EntryType | null>(expense?.type ?? null);
  const [date, setDate] = useState(expense?.date ?? today);
  const [method, setMethod] = useState<PaymentMethod>(expense?.payment_method ?? 'cash');
  const [note, setNote] = useState(expense?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [showRefund, setShowRefund] = useState(false);
  const { busy, run } = useBusy();

  const category = categoryById(categoryId);
  const effectiveType: EntryType = type ?? category?.type ?? 'WANT';

  const save = () =>
    run(async () => {
      const cents = parseMoneyToCents(amount);
      if (cents === null || cents <= 0) {
        setError('Please enter an amount, like 1250 or 1,250.50');
        return;
      }
      if (!categoryId && !editing) {
        setError('Please pick a category.');
        return;
      }
      setError(null);
      const body = {
        amount_cents: cents,
        category_id: categoryId,
        type: effectiveType,
        date,
        payment_method: method,
        note: note.trim() || null,
      };
      try {
        if (editing && expense) {
          await api(`/api/expenses/${expense.id}`, { method: 'PUT', body });
          toast({ message: 'Expense updated.' });
          changed();
          onClose();
          return;
        }
        // Smart warning for wants (needs never get a check when adding directly).
        const choice =
          effectiveType === 'WANT'
            ? await checkPurchase({ amount_cents: cents, type: 'WANT', category_id: categoryId })
            : 'buy';
        if (choice === 'cancel') return;
        if (choice === 'buy') {
          const res = await api<{ expense: Expense }>('/api/expenses', { method: 'POST', body });
          toast({
            message: `Saved ${formatMoney(cents, app.currency)}${category ? ` · ${category.name}` : ''}`,
            actionLabel: 'Undo',
            onAction: () => {
              api(`/api/expenses/${res.expense.id}`, { method: 'DELETE' })
                .then(changed)
                .catch((e) => toast({ message: errorMessage(e), tone: 'error' }));
            },
          });
        } else {
          // Remind me later / next month → keep it on the wishlist instead of spending now.
          const cooling = app.boot?.settings.cooling_days ?? 7;
          const reminder = choice === 'remind' ? addDays(today, cooling) : null;
          const res = await api<{ item: { id: number } }>('/api/wishlist', {
            method: 'POST',
            body: {
              name: note.trim() || category?.name || 'Purchase',
              category_id: categoryId,
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
            toast({
              message: `Saved to your wishlist. We will remind you on ${formatShort(reminder!)}.`,
            });
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
    // 5-second undo: the delete only happens if Undo is not pressed.
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
        toast({ message: `Refund of ${formatMoney(cents, app.currency)} added.` });
        changed();
        onClose();
      } catch (e) {
        setError(errorMessage(e));
      }
    });

  const title = isRefund ? 'Edit refund' : editing ? 'Edit expense' : 'Add expense';
  return (
    <Sheet title={title} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <MoneyField
          label={isRefund ? 'Refund amount' : 'Amount'}
          value={amount}
          onChange={setAmount}
          autoFocus
          big
        />

        {!isRefund && (
          <div className="field">
            <span className="label">Category</span>
            <div className="chips" role="group" aria-label="Category">
              {activeCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="chip"
                  aria-pressed={categoryId === c.id}
                  onClick={() => {
                    setCategoryId(c.id);
                    setType(null);
                  }}
                >
                  <span className="emoji" aria-hidden="true">
                    {c.icon}
                  </span>
                  {c.name}
                  <span className="sr-only">({c.type === 'NEED' ? 'need' : 'want'})</span>
                </button>
              ))}
            </div>
            {category && (
              <span className="hint row">
                <TypeTag type={effectiveType} />
                {type === null ? `from category ${category.name}` : 'changed by you'}
              </span>
            )}
          </div>
        )}

        {expense?.wishlist_item_id && (
          <p className="hint">
            This came from your wishlist. Changes here update the wishlist item too.
          </p>
        )}
        {expense?.fixed_bill_id && (
          <p className="hint">This is a bill payment. Changes update the bill for that cycle.</p>
        )}

        <details className="more" open={editing}>
          <summary>More details (date, payment, note)</summary>
          <div className="stack" style={{ marginTop: 8 }}>
            <div className="grid-2">
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
                <label htmlFor="exp-method">Payment</label>
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
            <div className="field">
              <label htmlFor="exp-note">Note</label>
              <input
                id="exp-note"
                className="input"
                value={note}
                maxLength={200}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional"
              />
            </div>
            {!isRefund && (
              <Segmented
                label="Need or want?"
                value={effectiveType}
                options={[
                  { value: 'NEED', label: '● Need' },
                  { value: 'WANT', label: '★ Want' },
                ]}
                onChange={setType}
              />
            )}
          </div>
        </details>

        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}

        <button className="btn primary block" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>

        {editing && expense && (
          <div className="stack" style={{ gap: 8 }}>
            {!isRefund && expense.amount_cents > 0 && (
              <>
                {!showRefund ? (
                  <button type="button" className="btn block" onClick={() => setShowRefund(true)}>
                    Add a refund
                  </button>
                ) : (
                  <div className="card flat stack" style={{ gap: 8 }}>
                    <MoneyField
                      label="Refund amount"
                      value={refundAmount}
                      onChange={setRefundAmount}
                      hint={
                        expense.refunded_cents
                          ? `Already refunded: ${app.fmt(expense.refunded_cents)}`
                          : 'Money you got back for this expense'
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
            <button
              type="button"
              className="btn ghost block soft-red"
              onClick={() => void remove()}
            >
              Delete {isRefund ? 'refund' : 'expense'}
            </button>
          </div>
        )}
      </form>
    </Sheet>
  );
}
