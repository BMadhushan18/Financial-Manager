import { useState } from 'react';
import { centsToInput, parseMoneyToCents } from '../../../shared/finance';
import {
  INCOME_SOURCES,
  type IncomeEntry,
  type IncomeSource,
  type IncomeStatus,
} from '../../../shared/types';
import { api, errorMessage } from '../../lib/api';
import { useApp } from '../../lib/context';
import { useBusy } from '../../lib/hooks';
import { SOURCE_LABEL } from '../../lib/labels';
import { MoneyField, Segmented, Sheet } from '../ui';

export function IncomeForm({ income, onClose }: { income?: IncomeEntry; onClose: () => void }) {
  const { today, toast, changed, deferDelete } = useApp();
  const [amount, setAmount] = useState(centsToInput(income?.amount_cents));
  const [source, setSource] = useState<IncomeSource>(income?.source ?? 'bonus');
  const [status, setStatus] = useState<IncomeStatus>(income?.status ?? 'received');
  const [date, setDate] = useState(income?.date ?? today);
  const [note, setNote] = useState(income?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useBusy();

  const save = () =>
    run(async () => {
      const cents = parseMoneyToCents(amount);
      if (cents === null || cents <= 0) {
        setError('Please enter an amount.');
        return;
      }
      setError(null);
      const body = { amount_cents: cents, source, status, date, note: note.trim() || null };
      try {
        if (income) await api(`/api/income/${income.id}`, { method: 'PUT', body });
        else await api('/api/income', { method: 'POST', body });
        toast({ message: income ? 'Income updated.' : 'Income added.' });
        changed();
        onClose();
      } catch (e) {
        setError(errorMessage(e));
      }
    });

  const remove = () => {
    if (!income) return;
    onClose();
    deferDelete(`income:${income.id}`, 'Income deleted.', () =>
      api(`/api/income/${income.id}`, { method: 'DELETE', keepalive: true }),
    );
  };

  return (
    <Sheet title={income ? 'Edit income' : 'New income'} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <MoneyField label="Amount" value={amount} onChange={setAmount} autoFocus big />
        <div className="form-grid">
          <div className="field">
            <label htmlFor="inc-source">Source</label>
            <select
              id="inc-source"
              className="input"
              value={source}
              onChange={(e) => setSource(e.target.value as IncomeSource)}
            >
              {INCOME_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="inc-date">Date</label>
            <input
              id="inc-date"
              className="input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <Segmented
          label="Status"
          value={status}
          options={[
            { value: 'received', label: 'Received' },
            { value: 'expected', label: 'Expected' },
          ]}
          onChange={setStatus}
        />
        <div className="field">
          <label htmlFor="inc-note">Description</label>
          <input
            id="inc-note"
            className="input"
            value={note}
            maxLength={200}
            placeholder="Optional"
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary lg block" type="submit" disabled={busy}>
          {busy ? 'Saving…' : income ? 'Save changes' : 'Add income'}
        </button>
        {income && (
          <button type="button" className="btn danger-ghost block" onClick={remove}>
            Delete income
          </button>
        )}
      </form>
    </Sheet>
  );
}
