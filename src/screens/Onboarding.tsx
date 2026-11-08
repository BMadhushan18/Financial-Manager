import { Plus } from 'lucide-react';
import { useState } from 'react';
import { parseMoneyToCents } from '../../shared/finance';
import type { CurrentCycleResponse, SavingsMode } from '../../shared/types';
import { MoneyField, Segmented } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { useApp } from '../lib/context';
import { useBusy } from '../lib/hooks';

interface Row {
  name: string;
  amount: string;
  day?: string;
}

/** First-time setup: salary → bills → savings → wishes → see safe-to-spend. Every step can be skipped. */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const { boot, fmt, refresh } = useApp();
  const [step, setStep] = useState(0);
  const [salary, setSalary] = useState('');
  const [salaryDay, setSalaryDay] = useState('25');
  const [bills, setBills] = useState<Row[]>([
    { name: 'Rent', amount: '', day: '1' },
    { name: 'Phone & internet', amount: '', day: '15' },
  ]);
  const [mode, setMode] = useState<SavingsMode>('percent');
  const [percent, setPercent] = useState('20');
  const [goalAmount, setGoalAmount] = useState('');
  const [wishes, setWishes] = useState<Row[]>([{ name: '', amount: '' }]);
  const [result, setResult] = useState<CurrentCycleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useBusy();

  const categoryId = (name: string) => boot?.categories.find((c) => c.name === name)?.id ?? null;
  const guessBillCategory = (name: string) => {
    const n = name.toLowerCase();
    if (/rent|house|board/.test(n)) return categoryId('Rent & housing');
    if (/phone|internet|mobile|fibre|wifi/.test(n)) return categoryId('Phone & internet');
    if (/loan|lease|emi/.test(n)) return categoryId('Loans');
    if (/insur/.test(n)) return categoryId('Insurance');
    if (/netflix|spotify|subscription|youtube|prime/.test(n)) return categoryId('Subscriptions');
    if (/electric|water|gas/.test(n)) return categoryId('Utilities');
    if (/school|tuition|class/.test(n)) return categoryId('Education');
    return null;
  };

  const next = () =>
    run(async () => {
      setError(null);
      try {
        if (step === 0) {
          const cents = salary.trim() ? parseMoneyToCents(salary) : 0;
          const day = Number(salaryDay);
          if (cents === null || cents < 0) return setError('Please check the salary amount.');
          if (!Number.isInteger(day) || day < 1 || day > 31)
            return setError('Salary day must be 1 to 31.');
          await api('/api/settings', {
            method: 'PUT',
            body: { salary_cents: cents, salary_day: day },
          });
        }
        if (step === 1) {
          for (const b of bills) {
            if (!b.name.trim() && !b.amount.trim()) continue;
            const cents = parseMoneyToCents(b.amount);
            const day = Number(b.day);
            if (!b.name.trim() || cents === null || cents <= 0)
              return setError(`Please complete "${b.name || 'bill'}" or clear it.`);
            if (!Number.isInteger(day) || day < 1 || day > 31)
              return setError(`Due day for ${b.name} must be 1 to 31.`);
            await api('/api/fixed-bills', {
              method: 'POST',
              body: {
                name: b.name.trim(),
                amount_cents: cents,
                due_day: day,
                category_id: guessBillCategory(b.name),
              },
            });
          }
          setBills([]);
        }
        if (step === 2) {
          const pct = Number(percent);
          const cents = parseMoneyToCents(goalAmount || '0');
          if (mode === 'percent' && (!Number.isInteger(pct) || pct < 0 || pct > 100))
            return setError('Percent must be 0 to 100.');
          if (mode === 'amount' && (cents === null || cents < 0))
            return setError('Please check the amount.');
          await api('/api/savings/goal', {
            method: 'PUT',
            body: { mode, percent: pct || 0, amount_cents: cents ?? 0 },
          });
        }
        if (step === 3) {
          for (const w of wishes) {
            if (!w.name.trim()) continue;
            const cents = w.amount.trim() ? parseMoneyToCents(w.amount) : null;
            if (w.amount.trim() && (cents === null || cents < 0))
              return setError(`Please check the price for ${w.name}.`);
            await api('/api/wishlist', {
              method: 'POST',
              body: { name: w.name.trim(), estimated_cents: cents },
            });
          }
          setWishes([]);
          setResult(await api<CurrentCycleResponse>('/api/cycle/current'));
        }
        setStep((s) => s + 1);
      } catch (e) {
        setError(errorMessage(e));
      }
    });

  const skipStep = async () => {
    setError(null);
    if (step === 3) {
      try {
        setResult(await api<CurrentCycleResponse>('/api/cycle/current'));
      } catch {
        // result screen copes with a missing number
      }
    }
    setStep((s) => s + 1);
  };

  const finish = () =>
    run(async () => {
      try {
        await api('/api/settings', { method: 'PUT', body: { onboarded: true } });
        await refresh();
        onDone();
      } catch (e) {
        setError(errorMessage(e));
      }
    });

  const rowEditor = (
    rows: Row[],
    setRows: (r: Row[]) => void,
    withDay: boolean,
    placeholder: string,
  ) => (
    <div className="stack" style={{ gap: 10 }}>
      {rows.map((r, i) => (
        <div
          key={i}
          className="panel panel-body stack-sm"
          style={{ background: 'var(--surface-2)' }}
        >
          <div className="field">
            <label htmlFor={`row-n-${i}`}>Name</label>
            <input
              id={`row-n-${i}`}
              className="input"
              value={r.name}
              placeholder={placeholder}
              onChange={(e) =>
                setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
              }
            />
          </div>
          <div className="form-grid">
            <MoneyField
              label={withDay ? 'Amount' : 'Price'}
              value={r.amount}
              onChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, amount: v } : x)))}
            />
            {withDay && (
              <div className="field">
                <label htmlFor={`row-d-${i}`}>Due day</label>
                <input
                  id={`row-d-${i}`}
                  className="input"
                  type="number"
                  min={1}
                  max={31}
                  inputMode="numeric"
                  value={r.day}
                  onChange={(e) =>
                    setRows(rows.map((x, j) => (j === i ? { ...x, day: e.target.value } : x)))
                  }
                />
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn sm danger-ghost"
            style={{ alignSelf: 'flex-end' }}
            onClick={() => setRows(rows.filter((_, j) => j !== i))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn"
        onClick={() => setRows([...rows, { name: '', amount: '', day: '1' }])}
      >
        <Plus size={16} /> Add another
      </button>
    </div>
  );

  const steps = [
    {
      title: 'Your salary',
      text: 'MoneyMind plans each "month" from one salary day to the next.',
      body: (
        <>
          <MoneyField
            label="Monthly salary (after tax)"
            value={salary}
            onChange={setSalary}
            autoFocus
            big
          />
          <div className="field">
            <label htmlFor="ob-day">Salary day</label>
            <input
              id="ob-day"
              className="input"
              type="number"
              min={1}
              max={31}
              inputMode="numeric"
              value={salaryDay}
              onChange={(e) => setSalaryDay(e.target.value)}
            />
            <span className="hint">
              e.g. 25 if you get paid on the 25th. You can switch to calendar months in Settings.
            </span>
          </div>
        </>
      ),
    },
    {
      title: 'Fixed bills',
      text: 'Things you pay every month: rent, loans, phone, subscriptions.',
      body: rowEditor(bills, setBills, true, 'e.g. Rent'),
    },
    {
      title: 'Savings goal',
      text: 'Pay yourself first – savings are set aside like a bill.',
      body: (
        <>
          <Segmented
            label="Goal type"
            value={mode}
            options={[
              { value: 'percent', label: '% of income' },
              { value: 'amount', label: 'Fixed amount' },
            ]}
            onChange={setMode}
          />
          {mode === 'percent' ? (
            <div className="field">
              <label htmlFor="ob-pct">Percent of income</label>
              <input
                id="ob-pct"
                className="input"
                type="number"
                min={0}
                max={100}
                inputMode="numeric"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
              />
              <span className="hint">20% follows the popular 50/30/20 rule.</span>
            </div>
          ) : (
            <MoneyField label="Amount each month" value={goalAmount} onChange={setGoalAmount} />
          )}
        </>
      ),
    },
    {
      title: 'Your first wishes',
      text: 'Things you would like to buy someday. Only the name is needed.',
      body: rowEditor(wishes, setWishes, false, 'e.g. New running shoes'),
    },
  ];

  if (step >= steps.length) {
    const safe = result?.safe_to_spend_cents;
    return (
      <main className="auth-main">
        <div className="auth-card panel panel-body stack" style={{ maxWidth: 520, padding: 28 }}>
          <div className="steps" aria-hidden="true">
            {steps.map((_, i) => (
              <span key={i} className="on" />
            ))}
          </div>
          <h1>You are all set</h1>
          {safe !== undefined && (
            <section className="panel" style={{ padding: 20, background: 'var(--surface-2)' }}>
              <p className="small muted strong">Safe to spend this cycle</p>
              <p
                className={`num ${safe < 0 ? 'neg' : ''}`}
                style={{ fontSize: '2.2rem', fontWeight: 700, letterSpacing: '-0.03em' }}
              >
                {fmt(safe)}
              </p>
              <p className="text-2 small">
                About {fmt(result!.safe_per_day_cents)} a day for {result!.days_left} days
              </p>
            </section>
          )}
          <p className="muted">
            This is what is left after bills, savings and planned buys. Add expenses as you go and
            the number updates.
          </p>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn primary lg block" onClick={() => void finish()} disabled={busy}>
            Open my dashboard
          </button>
        </div>
      </main>
    );
  }

  const current = steps[step]!;
  return (
    <main className="auth-main">
      <form
        className="auth-card panel panel-body stack"
        style={{ maxWidth: 560, padding: 28 }}
        onSubmit={(e) => {
          e.preventDefault();
          void next();
        }}
      >
        <div className="spread">
          <div
            className="steps grow"
            style={{ maxWidth: 240 }}
            aria-label={`Step ${step + 1} of ${steps.length}`}
          >
            {steps.map((_, i) => (
              <span key={i} className={i <= step ? 'on' : ''} />
            ))}
          </div>
          <button type="button" className="btn sm ghost" onClick={() => void finish()}>
            Skip setup
          </button>
        </div>
        <div>
          <p className="tiny muted">
            Step {step + 1} of {steps.length}
          </p>
          <h1 style={{ margin: '4px 0' }}>{current.title}</h1>
          <p className="muted small">{current.text}</p>
        </div>
        {current.body}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary lg block" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Next'}
        </button>
        <button className="btn ghost block" type="button" onClick={() => void skipStep()}>
          Skip this step
        </button>
      </form>
    </main>
  );
}
