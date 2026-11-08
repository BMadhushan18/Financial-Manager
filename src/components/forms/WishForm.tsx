import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { centsToInput, parseMoneyToCents } from '../../../shared/finance';
import {
  PRIORITIES,
  URGENCIES,
  type EntryType,
  type PriceHistoryEntry,
  type Priority,
  type Urgency,
  type WishlistItem,
} from '../../../shared/types';
import { api, errorMessage } from '../../lib/api';
import { useApp } from '../../lib/context';
import { useBusy } from '../../lib/hooks';
import { formatDate, PRIORITY_LABEL, URGENCY_LABEL } from '../../lib/labels';
import { ItemThumb } from '../ItemThumb';
import { MoneyField, Segmented, Sheet } from '../ui';

/** Edit a wishlist item. Only name, price and category up front; the rest is optional. */
export function WishForm({ item, onClose }: { item: WishlistItem; onClose: () => void }) {
  const { activeCategories, categoryById, toast, changed, fmt, confirm } = useApp();
  const [name, setName] = useState(item.name);
  const [categoryId, setCategoryId] = useState<number | null>(item.category_id);
  const [type, setType] = useState<EntryType>(item.type);
  const [priority, setPriority] = useState<Priority>(item.priority);
  const [urgency, setUrgency] = useState<Urgency>(item.urgency);
  const [price, setPrice] = useState(centsToInput(item.estimated_cents));
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [link, setLink] = useState(item.link ?? '');
  const [note, setNote] = useState(item.note ?? '');
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useBusy();

  useEffect(() => {
    api<{ price_history: PriceHistoryEntry[] }>(`/api/wishlist/${item.id}`)
      .then((r) => setHistory(r.price_history))
      .catch(() => undefined);
  }, [item.id]);

  const save = () =>
    run(async () => {
      if (!name.trim()) return setError('Please give the item a name.');
      const cents = price.trim() ? parseMoneyToCents(price) : null;
      if (price.trim() && (cents === null || cents < 0)) {
        return setError('Please enter a price like 15000 or 15,000.50.');
      }
      const qty = Number(quantity);
      if (!Number.isInteger(qty) || qty < 1 || qty > 999) {
        return setError('Quantity must be a whole number from 1 to 999.');
      }
      const trimmedLink = link.trim();
      if (trimmedLink && !/^https?:\/\//i.test(trimmedLink)) {
        return setError('Links must start with http:// or https://');
      }
      setError(null);
      // If the category changed and the user did not pick need/want, follow the category.
      const cat = categoryById(categoryId);
      const finalType =
        categoryId !== item.category_id && type === item.type && cat ? cat.type : type;
      try {
        await api(`/api/wishlist/${item.id}`, {
          method: 'PUT',
          body: {
            name: name.trim(),
            category_id: categoryId,
            type: finalType,
            priority,
            urgency,
            estimated_cents: cents,
            quantity: qty,
            link: trimmedLink || null,
            note: note.trim() || null,
          },
        });
        toast({ message: 'Saved.' });
        changed();
        onClose();
      } catch (e) {
        setError(errorMessage(e));
      }
    });

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete this item?',
      message:
        item.status === 'BOUGHT'
          ? 'The item is removed from history. Its expense stays, because the money was spent.'
          : 'It will be removed for good.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/wishlist/${item.id}`, { method: 'DELETE' });
      toast({ message: 'Item deleted.' });
      changed();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Sheet title="Edit item" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="row" style={{ gap: 12, alignItems: 'flex-end' }}>
          <ItemThumb name={name} category={categoryById(categoryId)} size={56} />
          <div className="field grow">
            <label htmlFor="wish-name">Item</label>
            <input
              id="wish-name"
              className="input"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>

        <MoneyField
          label="Price (about)"
          value={price}
          onChange={setPrice}
          hint="Optional – helps plan your month"
        />

        <div className="field">
          <label htmlFor="wish-cat">Category</label>
          <select
            id="wish-cat"
            className="input"
            value={categoryId ?? ''}
            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">No category</option>
            {activeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <details className="more">
          <summary>
            More options <ChevronDown size={16} />
          </summary>
          <div className="stack" style={{ marginTop: 12 }}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="wish-qty">Quantity</label>
                <input
                  id="wish-qty"
                  className="input"
                  type="number"
                  min={1}
                  max={999}
                  inputMode="numeric"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="wish-link">Shop link</label>
                <input
                  id="wish-link"
                  className="input"
                  type="url"
                  inputMode="url"
                  value={link}
                  placeholder="https://"
                  onChange={(e) => setLink(e.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="wish-note">Note</label>
              <textarea
                id="wish-note"
                className="input"
                value={note}
                maxLength={500}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <p className="hint">These are set automatically. Change them only if you want to.</p>
            <Segmented
              label="Need or want"
              value={type}
              options={[
                { value: 'NEED', label: 'Need' },
                { value: 'WANT', label: 'Want' },
              ]}
              onChange={setType}
            />
            <Segmented
              label="Importance"
              value={priority}
              options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
              onChange={setPriority}
            />
            <Segmented
              label="When"
              value={urgency}
              options={URGENCIES.map((u) => ({ value: u, label: URGENCY_LABEL[u] }))}
              onChange={setUrgency}
            />
            {history.length > 1 && (
              <div className="field">
                <span className="label">Price history</span>
                <ul className="rows panel">
                  {history.map((h) => (
                    <li key={h.id} className="spread small" style={{ padding: '8px 12px' }}>
                      <span className="muted">{formatDate(h.changed_at)}</span>
                      <span className="num strong">{fmt(h.price_cents)}</span>
                    </li>
                  ))}
                </ul>
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
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn danger-ghost block" onClick={() => void remove()}>
          Delete item
        </button>
      </form>
    </Sheet>
  );
}
