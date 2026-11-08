import { useState } from 'react';
import { centsToInput, itemTotalCents, parseMoneyToCents } from '../../../shared/finance';
import { PAYMENT_METHODS, type PaymentMethod, type WishlistItem } from '../../../shared/types';
import { useWishActions } from '../../lib/actions';
import { api, errorMessage } from '../../lib/api';
import { useApp } from '../../lib/context';
import { useBusy } from '../../lib/hooks';
import { METHOD_LABEL } from '../../lib/labels';
import { MoneyField, Sheet, TypeTag } from '../ui';

/** Mark a wish as bought: actual price + date, then the smart check, then ONE linked expense. */
export function BoughtForm({ item, onClose }: { item: WishlistItem; onClose: () => void }) {
  const { today, checkPurchase, toast, changed, fmt } = useApp();
  const { undo, handleDeferChoice } = useWishActions();
  const estimate = itemTotalCents(item);
  const [price, setPrice] = useState(estimate > 0 ? centsToInput(estimate) : '');
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useBusy();

  const submit = () =>
    run(async () => {
      const cents = parseMoneyToCents(price);
      if (cents === null || cents <= 0) {
        setError('Please enter the price you paid.');
        return;
      }
      setError(null);
      try {
        const choice = await checkPurchase({
          amount_cents: cents,
          type: item.type,
          category_id: item.category_id,
          wishlist_item_id: item.id,
        });
        if (choice === 'cancel') return;
        if (choice !== 'buy') {
          await handleDeferChoice(item, choice);
          onClose();
          return;
        }
        await api(`/api/wishlist/${item.id}/bought`, {
          method: 'POST',
          body: { actual_cents: cents, date, payment_method: method },
        });
        toast({
          message: `${item.name} bought for ${fmt(cents)}. Added to expenses.`,
          actionLabel: 'Undo',
          onAction: () => void undo({ ...item, status: 'BOUGHT' }, true),
        });
        changed();
        onClose();
      } catch (e) {
        setError(errorMessage(e));
      }
    });

  return (
    <Sheet title="Mark as bought" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="row">
          <strong className="grow">{item.name}</strong>
          <TypeTag type={item.type} />
        </div>
        <MoneyField
          label="Price you paid"
          value={price}
          onChange={setPrice}
          autoFocus
          big
          hint={estimate > 0 ? `Estimate was ${fmt(estimate)}` : undefined}
        />
        <div className="grid-2">
          <div className="field">
            <label htmlFor="bought-date">Date</label>
            <input
              id="bought-date"
              className="input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="bought-method">Payment</label>
            <select
              id="bought-method"
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
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary block" type="submit" disabled={busy}>
          {busy ? 'Checking…' : 'Mark as bought'}
        </button>
      </form>
    </Sheet>
  );
}
