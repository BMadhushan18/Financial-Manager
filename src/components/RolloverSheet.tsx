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
        toast({ message: 'Your new cycle is ready.' });
        changed();
      } catch (e) {
        setError(errorMessage(e));
      }
    });

  const options: { value: RolloverDecision; label: string }[] = [
    { value: 'next', label: 'Keep planned' },
    { value: 'idea', label: 'Back to ideas' },
    { value: 'drop', label: 'Drop' },
  ];

  return (
    <Sheet
      title="Start of a new cycle"
      subtitle={`Last cycle ended ${formatShort(previousEnd)}`}
      onClose={onLater}
    >
      <p className="text-2 small">
        These planned items were not bought. Choose what happens to each one. Nothing moves until
        you decide.
      </p>
      <div className="row wrap" style={{ margin: '14px 0 6px' }}>
        <span className="tiny muted strong">APPLY TO ALL</span>
        {options.map((o) => (
          <button key={o.value} type="button" className="btn sm" onClick={() => setAll(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
      <ul className="rows" style={{ margin: '0 -20px' }}>
        {items.map((item) => (
          <li key={item.id} style={{ padding: '12px 20px' }} className="stack-sm">
            <div className="spread">
              <span className="strong small ellipsis">{item.name}</span>
              <span className="num muted small">{fmt(itemTotalCents(item))}</span>
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
        <button
          className="btn primary lg"
          disabled={!allChosen || busy}
          onClick={() => void submit()}
        >
          {allChosen ? 'Save and continue' : 'Choose for every item'}
        </button>
        <button className="btn ghost" onClick={onLater}>
          Decide later
        </button>
      </div>
    </Sheet>
  );
}
