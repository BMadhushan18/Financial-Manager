import { ChevronDown, Lightbulb } from 'lucide-react';
import { useEffect, useState } from 'react';
import { centsToInput, parseMoneyToCents, suggestType } from '../../../shared/finance';
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
import { MoneyField, Segmented, Sheet } from '../ui';

/** Add or edit a wishlist item. Only the name is required. */
export function WishForm({ item, onClose }: { item?: WishlistItem; onClose: () => void }) {
  const { activeCategories, categoryById, toast, changed, fmt, confirm } = useApp();
  const editing = Boolean(item);
  const [name, setName] = useState(item?.name ?? '');
  const [categoryId, setCategoryId] = useState<number | null>(item?.category_id ?? null);
  const [typeChoice, setTypeChoice] = useState<EntryType | null>(item?.type ?? null);
  const [priority, setPriority] = useState<Priority>(item?.priority ?? 'MEDIUM');
  const [urgency, setUrgency] = useState<Urgency>(item?.urgency ?? 'SOMEDAY');
  const [price, setPrice] = useState(centsToInput(item?.estimated_cents));
  const [quantity, setQuantity] = useState(String(item?.quantity ?? 1));
  const [link, setLink] = useState(item?.link ?? '');
  const [note, setNote] = useState(item?.note ?? '');
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useBusy();

  useEffect(() => {
    if (!item) return;
    api<{ price_history: PriceHistoryEntry[] }>(`/api/wishlist/${item.id}`)
      .then((r) => setHistory(r.price_history))
      .catch(() => undefined);
  }, [item]);

  const category = categoryById(categoryId);
  const suggestion = suggestType(name, category ?? null);
  const type = typeChoice ?? suggestion.type;

  const save = () =>
    run(async () => {
      if (!name.trim()) {
        setError('Please give the item a name.');
        return;
      }
      const cents = price.trim() ? parseMoneyToCents(price) : null;
      if (price.trim() && (cents === null || cents < 0)) {
        setError('Please enter a price like 15000 or 15,000.50.');
        return;
      }
      const qty = Number(quantity);
      if (!Number.isInteger(qty) || qty < 1 || qty > 999) {
        setError('Quantity must be a whole number from 1 to 999.');
        return;
      }
      const trimmedLink = link.trim();
      if (trimmedLink && !/^https?:\/\//i.test(trimmedLink)) {
        setError('Links must start with http:// or https://');
        return;
      }
      setError(null);
      const body = {
        name: name.trim(),
        category_id: categoryId,
        type,
        priority,
        urgency,
        estimated_cents: cents,
        quantity: qty,
        link: trimmedLink || null,
        note: note.trim() || null,
      };
      try {
        if (item) {
          await api(`/api/wishlist/${item.id}`, { method: 'PUT', body });
          toast({ message: 'Wishlist item updated.' });
        } else {
          await api('/api/wishlist', { method: 'POST', body });
          toast({ message: `"${body.name}" added to your wishlist.` });
        }
        changed();
        onClose();
      } catch (e) {
        setError(errorMessage(e));
      }
    });

  const remove = async () => {
    if (!item) return;
    const ok = await confirm({
      title: 'Delete this item permanently?',
      message:
        item.status === 'BOUGHT'
          ? 'The item is removed from history. Its expense stays, because the money was spent.'
          : 'It will be removed for good. Tip: "Drop" keeps it in history and counts the money saved.',
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
    <Sheet
      title={editing ? 'Edit wishlist item' : 'New wishlist item'}
      subtitle={editing ? undefined : 'Only the name is required. Add details any time.'}
      onClose={onClose}
    >
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="field">
          <label htmlFor="wish-name">Item name</label>
          <input
            id="wish-name"
            className="input"
            value={name}
            maxLength={120}
            autoFocus
            placeholder="e.g. Running shoes"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="form-grid">
          <MoneyField label="Estimated price" value={price} onChange={setPrice} />
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
                  {c.name} ({c.type === 'NEED' ? 'need' : 'want'})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="stack-sm">
          <Segmented
            label="Need or want"
            value={type}
            options={[
              { value: 'NEED', label: 'Need' },
              { value: 'WANT', label: 'Want' },
            ]}
            onChange={setTypeChoice}
          />
          <div className="callout" style={{ padding: '8px 12px' }}>
            <Lightbulb size={16} className="muted" />
            <span className="small">
              {typeChoice === null || typeChoice === suggestion.type
                ? suggestion.reason
                : `You chose ${type}. (${suggestion.reason}.)`}
            </span>
          </div>
        </div>

        <details className="more" open={editing}>
          <summary>
            Priority, urgency and more <ChevronDown size={16} />
          </summary>
          <div className="stack" style={{ marginTop: 12 }}>
            <Segmented
              label="How important is it to you?"
              value={priority}
              options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
              onChange={setPriority}
            />
            <Segmented
              label="When do you need it?"
              value={urgency}
              options={URGENCIES.map((u) => ({ value: u, label: URGENCY_LABEL[u] }))}
              onChange={setUrgency}
            />
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
                <label htmlFor="wish-link">Link</label>
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
          </div>
        </details>

        {history.length > 1 && (
          <div className="panel">
            <div className="panel-head" style={{ minHeight: 0, padding: '10px 16px' }}>
              <h3>Price history</h3>
            </div>
            <ul className="rows">
              {history.map((h) => (
                <li key={h.id} className="spread small" style={{ padding: '8px 16px' }}>
                  <span className="muted">{formatDate(h.changed_at)}</span>
                  <span className="num strong">{fmt(h.price_cents)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary lg block" type="submit" disabled={busy}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Add to wishlist'}
        </button>
        {editing && (
          <button type="button" className="btn danger-ghost block" onClick={() => void remove()}>
            Delete permanently
          </button>
        )}
      </form>
    </Sheet>
  );
}
