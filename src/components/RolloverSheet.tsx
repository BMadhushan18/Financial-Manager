import { useState } from 'react';
import { itemTotalCents } from '../../shared/finance';
import type { RolloverDecision, WishlistItem } from '../../shared/types';
import { api, errorMessage } from '../lib/api';
import { useApp } from '../lib/context';
import { useBusy } from '../lib/hooks';
import { formatShort } from '../lib/labels';
import { Sheet } from './ui';

/** End of cycle: every planned item that was not bought needs an explicit choice. */
export function RolloverSheet({
  items,
  previousEnd,
  onLater,
}: {
  items: WishlistItem[];
  previousEnd: string;
  onLater: () => void;
}) {
  const { fmt, toast, changed } = useApp();
  const [decisions, setDecisions] = useState<Record<number, RolloverDecision>>({});
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useBusy();
  const allChosen = items.every((i) => decisions[i.id]);

  const setAll = (d: RolloverDecision) =>
    setDecisions(Object.fromEntries(items.map((i) => [i.id, d])));

  const submit = () =>
    run(async () => {
      try {
        await api('/api/cycle/close', { method: 'POST', body: { decisions } });
        toast({ message: 'Done. Your new cycle is ready.' });
        changed();
      } catch (e) {
        setError(errorMessage(e));
      }
    });

  const options: { value: RolloverDecision; label: string }[] = [
    { value: 'next', label: 'This cycle' },
    { value: 'idea', label: 'Back to ideas' },
    { value: 'drop', label: 'Drop' },
  ];

  return (
    <Sheet title="New cycle – a quick tidy-up" onClose={onLater}>
      <p className="muted small" style={{ marginBottom: 12 }}>
        Your last cycle ended on {formatShort(previousEnd)}. These planned items were not bought.
        What would you like to do with each? Nothing moves until you choose.
      </p>
      <div className="row wrap" style={{ marginBottom: 8 }}>
        <span className="small muted">Set all:</span>
        {options.map((o) => (
          <button key={o.value} type="button" className="btn small" onClick={() => setAll(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
      <ul className="list">
        {items.map((item) => (
          <li key={item.id} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div className="spread">
              <strong className="ellipsis">{item.name}</strong>
              <span className="amount muted">{fmt(itemTotalCents(item))}</span>
            </div>
            <div className="segmented" role="group" aria-label={`What to do with ${item.name}`}>
              {options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={decisions[item.id] === o.value}
                  onClick={() => setDecisions((d) => ({ ...d, [item.id]: o.value }))}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="sheet-actions">
        <button className="btn primary" disabled={!allChosen || busy} onClick={() => void submit()}>
          {allChosen ? 'Save choices' : 'Choose for every item'}
        </button>
        <button className="btn ghost" onClick={onLater}>
          Later
        </button>
      </div>
    </Sheet>
  );
}
