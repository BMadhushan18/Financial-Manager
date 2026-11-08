import { Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { useQuickAdd } from '../lib/quickAdd';

/** To-do style input: type anything, press Enter or tap Add. */
export function AddItemBar({ autoFocus, onAdded }: { autoFocus?: boolean; onAdded?: () => void }) {
  const quickAdd = useQuickAdd();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const add = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    const created = await quickAdd(name);
    setBusy(false);
    if (created) {
      setName('');
      onAdded?.();
      input.current?.focus();
    }
  };

  return (
    <form
      className="add-bar"
      onSubmit={(e) => {
        e.preventDefault();
        void add();
      }}
    >
      <input
        ref={input}
        className="add-input"
        aria-label="Add something you want to buy"
        placeholder="Add something you want to buy…"
        autoComplete="off"
        maxLength={120}
        autoFocus={autoFocus}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button className="btn primary" type="submit" disabled={!name.trim() || busy}>
        <Plus size={17} /> Add
      </button>
    </form>
  );
}
