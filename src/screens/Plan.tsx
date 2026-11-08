import { useMemo, useState } from 'react';
import { centsToInput, parseMoneyToCents, ratioPercent } from '../../shared/finance';
import type { BillInCycle, Category, Expense, FixedBill, SavingsMode } from '../../shared/types';
import { EmptyState, Money, MoneyField, Segmented, Sheet, TypeTag } from '../components/ui';
import { WishCard } from '../components/WishCard';
import { api, errorMessage } from '../lib/api';
import { useApp } from '../lib/context';
import { useApi, useBusy } from '../lib/hooks';
import { formatShort, SOURCE_LABEL } from '../lib/labels';

export function Plan() {
  const app = useApp();
  const { cycle, fmt, openSheet, toast, changed, confirm, version, isHidden, deferDelete } = app;
  const [billSheet, setBillSheet] = useState<FixedBill | 'new' | null>(null);
  const [goalSheet, setGoalSheet] = useState(false);
  const [moveSheet, setMoveSheet] = useState(false);
  const [limitFor, setLimitFor] = useState<Category | null>(null);
  const expenses = useApi<{ expenses: Expense[] }>(
    cycle ? `/api/expenses?from=${cycle.cycle.start}&to=${cycle.cycle.end}` : null,
    [version],
  );
  const spentByCategory = useMemo(() => {
    const m = new Map<number, number>();
    for (const e of expenses.data?.expenses ?? []) {
      if (e.category_id !== null)
        m.set(e.category_id, (m.get(e.category_id) ?? 0) + e.amount_cents);
    }
    return m;
  }, [expenses.data]);

  if (!cycle) return null;
  const t = cycle.totals;
  const fail = (e: unknown) => toast({ message: errorMessage(e), tone: 'error' });
  const savingsNotMoved = Math.max(t.savings_goal_cents - t.savings_moved_cents, 0);
  const allBills: FixedBill[] = app.boot?.bills ?? [];
  const inactiveBills = allBills.filter((b) => !b.is_active);

  const payBill = async (b: BillInCycle) => {
    try {
      await api(`/api/fixed-bills/${b.id}/pay`, { method: 'POST', body: {} });
      toast({ message: `${b.name} marked paid and added to expenses.` });
      changed();
    } catch (e) {
      fail(e);
    }
  };
  const unpayBill = async (b: BillInCycle) => {
    const ok = await confirm({
      title: `Mark ${b.name} unpaid?`,
      message: 'The payment and its linked expense will be removed.',
      confirmLabel: 'Mark unpaid',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/fixed-bills/${b.id}/unpay`, {
        method: 'POST',
        body: { cycle_start: cycle.cycle.start },
      });
      changed();
    } catch (e) {
      fail(e);
    }
  };

  return (
    <div className="stack">
      <section className="card" aria-labelledby="rem-h">
        <div className="card-head">
          <h2 id="rem-h">
            {formatShort(cycle.cycle.start)} – {formatShort(cycle.cycle.end)}
          </h2>
          <span className="tiny muted">{cycle.days_left} days left</span>
        </div>
        <div className="breakdown">
          <span>Income (received + expected)</span>
          <Money cents={t.income_cents} />
          <span className="muted">− Fixed bills (paid + unpaid)</span>
          <Money cents={-t.bills_committed_cents} />
          <span className="muted">− Savings (moved + still to move)</span>
          <Money cents={-(t.savings_moved_cents + savingsNotMoved)} />
          <span className="muted">− Planned wishlist items</span>
          <Money cents={-t.reserved_cents} />
          <span className="muted">− Other spending</span>
          <Money cents={-t.other_expenses_cents} />
          <span className="total">Safe to spend</span>
          <span className={`total amount ${cycle.safe_to_spend_cents < 0 ? 'soft-red' : ''}`}>
            {fmt(cycle.safe_to_spend_cents)}
          </span>
        </div>
      </section>

      {/* ---------- income ---------- */}
      <section className="card" aria-labelledby="inc-h">
        <div className="card-head">
          <h2 id="inc-h">💰 Income</h2>
          <button className="btn small" onClick={() => openSheet({ kind: 'income' })}>
            Add
          </button>
        </div>
        {cycle.incomes.filter((i) => !isHidden(`income:${i.id}`)).length === 0 ? (
          <EmptyState
            emoji="💰"
            title="No income yet this cycle"
            text="Add your salary or set it in Settings so it appears every cycle."
          />
        ) : (
          <ul className="list">
            {cycle.incomes
              .filter((i) => !isHidden(`income:${i.id}`))
              .map((i) => (
                <li key={i.id}>
                  <button
                    className="list-btn"
                    onClick={() => openSheet({ kind: 'income', income: i })}
                  >
                    <span className="grow">
                      <span style={{ display: 'block' }}>{i.note || SOURCE_LABEL[i.source]}</span>
                      <span className="tiny muted">
                        {SOURCE_LABEL[i.source]} · {formatShort(i.date)}{' '}
                        <span className={`tag ${i.status === 'received' ? 'save' : 'neutral'}`}>
                          {i.status === 'received' ? '✓ Received' : 'Expected'}
                        </span>
                      </span>
                    </span>
                    <Money cents={i.amount_cents} />
                  </button>
                  {i.status === 'expected' && (
                    <button
                      className="btn small"
                      onClick={async () => {
                        try {
                          await api(`/api/income/${i.id}`, {
                            method: 'PUT',
                            body: { status: 'received' },
                          });
                          toast({ message: 'Marked as received.' });
                          changed();
                        } catch (e) {
                          fail(e);
                        }
                      }}
                    >
                      Received
                    </button>
                  )}
                </li>
              ))}
          </ul>
        )}
      </section>

      {/* ---------- bills ---------- */}
      <section className="card" aria-labelledby="bill-h">
        <div className="card-head">
          <h2 id="bill-h">🧾 Fixed bills</h2>
          <button className="btn small" onClick={() => setBillSheet('new')}>
            Add bill
          </button>
        </div>
        {cycle.bills.length === 0 ? (
          <EmptyState
            emoji="🧾"
            title="No fixed bills"
            text="Add rent, loans, phone, subscriptions… they repeat every cycle."
          />
        ) : (
          <>
            <p className="small muted" style={{ marginBottom: 6 }}>
              Paid {fmt(t.bills_paid_cents)} · still to pay {fmt(t.bills_unpaid_cents)}
            </p>
            <ul className="list">
              {cycle.bills.map((b) => (
                <li key={b.id}>
                  <button
                    className="list-btn"
                    onClick={() => setBillSheet(allBills.find((x) => x.id === b.id) ?? null)}
                  >
                    <span className="grow">
                      <span style={{ display: 'block' }}>{b.name}</span>
                      <span className="tiny muted row wrap" style={{ gap: 4 }}>
                        <TypeTag type={b.type} /> Due {formatShort(b.due_date)}
                        {b.is_paid && b.paid_at && ` · paid ${formatShort(b.paid_at)}`}
                      </span>
                    </span>
                    <Money cents={b.is_paid ? (b.paid_cents ?? b.amount_cents) : b.amount_cents} />
                  </button>
                  {b.is_paid ? (
                    <button
                      className="btn small ghost"
                      onClick={() => void unpayBill(b)}
                      aria-label={`${b.name} is paid. Mark unpaid`}
                    >
                      ✓ Paid
                    </button>
                  ) : (
                    <button className="btn small" onClick={() => void payBill(b)}>
                      Pay
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        {inactiveBills.length > 0 && (
          <p className="tiny muted" style={{ marginTop: 8 }}>
            Paused bills:{' '}
            {inactiveBills.map((b) => (
              <button key={b.id} className="btn small ghost" onClick={() => setBillSheet(b)}>
                {b.name}
              </button>
            ))}
          </p>
        )}
      </section>

      {/* ---------- savings ---------- */}
      <section className="card" aria-labelledby="sav-h">
        <div className="card-head">
          <h2 id="sav-h">🌱 Savings (pay yourself first)</h2>
          <button className="btn small" onClick={() => setGoalSheet(true)}>
            Edit goal
          </button>
        </div>
        <div className="stat-grid">
          <div className="stat">
            <div className="tiny muted">Goal this cycle</div>
            <div className="value">{fmt(t.savings_goal_cents)}</div>
            <div className="tiny muted">
              {cycle.savings.goal.mode === 'percent'
                ? `${cycle.savings.goal.percent}% of income`
                : 'fixed amount'}
            </div>
          </div>
          <div className="stat">
            <div className="tiny muted">Moved so far</div>
            <div className="value positive">{fmt(t.savings_moved_cents)}</div>
            <div className="tiny muted">
              {savingsNotMoved > 0 ? `${fmt(savingsNotMoved)} to go` : 'Goal reached 🎉'}
            </div>
          </div>
        </div>
        <div className="progress" style={{ marginTop: 12 }}>
          <div className="spread small">
            <span>Emergency fund</span>
            <span className="amount muted">
              {fmt(cycle.savings.balance_cents)} of {fmt(cycle.savings.emergency_target_cents)}
            </span>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Emergency fund progress"
            aria-valuenow={ratioPercent(
              cycle.savings.balance_cents,
              cycle.savings.emergency_target_cents,
            )}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="progress-fill"
              style={{
                width: `${Math.min(ratioPercent(Math.max(cycle.savings.balance_cents, 0), cycle.savings.emergency_target_cents), 100)}%`,
                background: 'var(--savings)',
              }}
            />
          </div>
        </div>
        <button className="btn block" style={{ marginTop: 12 }} onClick={() => setMoveSheet(true)}>
          Move money to savings
        </button>
        {cycle.savings.moves.filter((m) => !isHidden(`move:${m.id}`)).length > 0 && (
          <ul className="list small" style={{ marginTop: 8 }}>
            {cycle.savings.moves
              .filter((m) => !isHidden(`move:${m.id}`))
              .map((m) => (
                <li key={m.id}>
                  <span className="grow">
                    {m.note || (m.amount_cents > 0 ? 'Moved to savings' : 'Taken from savings')}
                    <span className="tiny muted"> · {formatShort(m.date)}</span>
                  </span>
                  <Money
                    cents={m.amount_cents}
                    signed
                    className={m.amount_cents > 0 ? 'positive' : 'soft-red'}
                  />
                  <button
                    className="btn small ghost"
                    aria-label="Delete this savings entry"
                    onClick={() =>
                      deferDelete(`move:${m.id}`, 'Savings entry deleted.', () =>
                        api(`/api/savings/moves/${m.id}`, { method: 'DELETE', keepalive: true }),
                      )
                    }
                  >
                    ✕
                  </button>
                </li>
              ))}
          </ul>
        )}
      </section>

      {/* ---------- planned ---------- */}
      <section className="stack" style={{ gap: 10 }} aria-labelledby="pl-h">
        <div className="spread">
          <h2 id="pl-h">🗓️ Planned purchases</h2>
          <span className="small muted">{fmt(t.reserved_cents)} set aside</span>
        </div>
        {cycle.planned.length === 0 ? (
          <div className="card">
            <EmptyState
              emoji="🗓️"
              title="Nothing planned"
              text="Plan wishlist items to set their price aside this cycle."
              action={
                <a className="btn" href="#/wishlist">
                  Open wishlist
                </a>
              }
            />
          </div>
        ) : (
          cycle.planned.map((item) => <WishCard key={item.id} item={item} />)
        )}
      </section>

      {/* ---------- category budgets ---------- */}
      <section className="card" aria-labelledby="bud-h">
        <div className="card-head">
          <h2 id="bud-h">Category budgets</h2>
        </div>
        <p className="small muted" style={{ marginBottom: 8 }}>
          Optional monthly limits. Tap a category to set one.
        </p>
        <ul className="list">
          {app.activeCategories.map((c) => {
            const spent = spentByCategory.get(c.id) ?? 0;
            const limit = c.monthly_limit_cents;
            const pct = limit ? ratioPercent(spent, limit) : 0;
            return (
              <li key={c.id}>
                <button className="list-btn" onClick={() => setLimitFor(c)}>
                  <span className="icon-dot" aria-hidden="true">
                    {c.icon}
                  </span>
                  <span className="grow">
                    <span style={{ display: 'block' }}>{c.name}</span>
                    {limit ? (
                      <span
                        className="progress-track"
                        style={{ display: 'block', height: 6, marginTop: 4 }}
                      >
                        <span
                          className="progress-fill"
                          style={{
                            display: 'block',
                            width: `${Math.min(pct, 100)}%`,
                            background:
                              pct > 100
                                ? 'var(--danger)'
                                : c.type === 'NEED'
                                  ? 'var(--needs)'
                                  : 'var(--wants)',
                          }}
                        />
                      </span>
                    ) : (
                      <span className="tiny muted">No limit</span>
                    )}
                  </span>
                  <span className="amount small">
                    {fmt(spent)}
                    {limit ? <span className="muted"> / {fmt(limit)}</span> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {billSheet && (
        <BillSheet
          bill={billSheet === 'new' ? null : billSheet}
          onClose={() => setBillSheet(null)}
        />
      )}
      {goalSheet && <GoalSheet onClose={() => setGoalSheet(false)} />}
      {moveSheet && <MoveSheet onClose={() => setMoveSheet(false)} suggested={savingsNotMoved} />}
      {limitFor && <LimitSheet category={limitFor} onClose={() => setLimitFor(null)} />}
    </div>
  );
}

/* ---------------- small sheets ---------------- */

export function BillSheet({ bill, onClose }: { bill: FixedBill | null; onClose: () => void }) {
  const { activeCategories, toast, changed, confirm } = useApp();
  const [name, setName] = useState(bill?.name ?? '');
  const [amount, setAmount] = useState(centsToInput(bill?.amount_cents));
  const [dueDay, setDueDay] = useState(String(bill?.due_day ?? 1));
  const [categoryId, setCategoryId] = useState<number | null>(
    bill?.category_id ?? activeCategories.find((c) => c.name === 'Rent & housing')?.id ?? null,
  );
  const [active, setActive] = useState(bill?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useBusy();

  const save = () =>
    run(async () => {
      const cents = parseMoneyToCents(amount);
      const day = Number(dueDay);
      if (!name.trim()) return setError('Please name the bill.');
      if (cents === null || cents <= 0) return setError('Please enter the amount.');
      if (!Number.isInteger(day) || day < 1 || day > 31)
        return setError('Due day must be 1 to 31.');
      const body = {
        name: name.trim(),
        amount_cents: cents,
        due_day: day,
        category_id: categoryId,
        is_active: active,
      };
      try {
        if (bill) await api(`/api/fixed-bills/${bill.id}`, { method: 'PUT', body });
        else await api('/api/fixed-bills', { method: 'POST', body });
        toast({ message: bill ? 'Bill updated.' : 'Bill added. It repeats every cycle.' });
        changed();
        onClose();
      } catch (e) {
        setError(errorMessage(e));
      }
    });

  const remove = async () => {
    if (!bill) return;
    const ok = await confirm({
      title: `Delete ${bill.name}?`,
      message: 'Past payments stay in your expenses. Tip: switch it off instead to pause it.',
      confirmLabel: 'Delete bill',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/fixed-bills/${bill.id}`, { method: 'DELETE' });
      changed();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Sheet title={bill ? 'Edit bill' : 'Add a fixed bill'} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="field">
          <label htmlFor="bill-name">Name</label>
          <input
            id="bill-name"
            className="input"
            value={name}
            maxLength={60}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. House rent"
          />
        </div>
        <MoneyField label="Amount" value={amount} onChange={setAmount} />
        <div className="grid-2">
          <div className="field">
            <label htmlFor="bill-day">Due day of month</label>
            <input
              id="bill-day"
              className="input"
              type="number"
              min={1}
              max={31}
              inputMode="numeric"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="bill-cat">Category</label>
            <select
              id="bill-cat"
              className="input"
              value={categoryId ?? ''}
              onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">None (need)</option>
              {activeCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {bill && (
          <label className="switch">
            <span>Active (repeats every cycle)</span>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          </label>
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary block" disabled={busy} type="submit">
          Save
        </button>
        {bill && (
          <button type="button" className="btn ghost block soft-red" onClick={() => void remove()}>
            Delete bill
          </button>
        )}
      </form>
    </Sheet>
  );
}

export function GoalSheet({ onClose }: { onClose: () => void }) {
  const { boot, toast, changed } = useApp();
  const goal = boot!.savings_goal;
  const [mode, setMode] = useState<SavingsMode>(goal.mode);
  const [percent, setPercent] = useState(String(goal.percent));
  const [amount, setAmount] = useState(centsToInput(goal.amount_cents));
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useBusy();
  const save = () =>
    run(async () => {
      const pct = Number(percent);
      const cents = parseMoneyToCents(amount || '0');
      if (mode === 'percent' && (!Number.isInteger(pct) || pct < 0 || pct > 100))
        return setError('Percent must be 0 to 100.');
      if (mode === 'amount' && (cents === null || cents < 0))
        return setError('Please enter an amount.');
      try {
        await api('/api/savings/goal', {
          method: 'PUT',
          body: { mode, percent: pct || 0, amount_cents: cents ?? 0 },
        });
        toast({ message: 'Savings goal saved.' });
        changed();
        onClose();
      } catch (e) {
        setError(errorMessage(e));
      }
    });
  return (
    <Sheet title="Savings goal" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
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
            <label htmlFor="goal-pct">Percent of income</label>
            <input
              id="goal-pct"
              className="input"
              type="number"
              min={0}
              max={100}
              inputMode="numeric"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
            />
            <span className="hint">The 50/30/20 rule suggests 20%.</span>
          </div>
        ) : (
          <MoneyField label="Amount each cycle" value={amount} onChange={setAmount} />
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary block" disabled={busy} type="submit">
          Save goal
        </button>
      </form>
    </Sheet>
  );
}

function MoveSheet({ onClose, suggested }: { onClose: () => void; suggested: number }) {
  const { toast, changed, today } = useApp();
  const [amount, setAmount] = useState(suggested > 0 ? centsToInput(suggested) : '');
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useBusy();
  const save = () =>
    run(async () => {
      const cents = parseMoneyToCents(amount);
      if (cents === null || cents <= 0) return setError('Please enter an amount.');
      try {
        await api('/api/savings/moves', {
          method: 'POST',
          body: {
            amount_cents: direction === 'in' ? cents : -cents,
            date: today,
            note: note.trim() || null,
          },
        });
        toast({
          message: direction === 'in' ? 'Nice – moved to savings. 🌱' : 'Taken from savings.',
        });
        changed();
        onClose();
      } catch (e) {
        setError(errorMessage(e));
      }
    });
  return (
    <Sheet title="Savings" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Segmented
          label="Direction"
          value={direction}
          options={[
            { value: 'in', label: 'Put into savings' },
            { value: 'out', label: 'Take out' },
          ]}
          onChange={setDirection}
        />
        <MoneyField label="Amount" value={amount} onChange={setAmount} autoFocus big />
        <div className="field">
          <label htmlFor="move-note">Note</label>
          <input
            id="move-note"
            className="input"
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
          />
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary block" disabled={busy} type="submit">
          Save
        </button>
      </form>
    </Sheet>
  );
}

function LimitSheet({ category, onClose }: { category: Category; onClose: () => void }) {
  const { toast, changed } = useApp();
  const [amount, setAmount] = useState(centsToInput(category.monthly_limit_cents));
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useBusy();
  const save = (clear = false) =>
    run(async () => {
      const cents = clear || !amount.trim() ? null : parseMoneyToCents(amount);
      if (!clear && amount.trim() && (cents === null || cents < 0))
        return setError('Please enter an amount.');
      try {
        await api(`/api/categories/${category.id}`, {
          method: 'PUT',
          body: { monthly_limit_cents: cents },
        });
        toast({ message: cents === null ? 'Limit removed.' : 'Budget saved.' });
        changed();
        onClose();
      } catch (e) {
        setError(errorMessage(e));
      }
    });
  return (
    <Sheet title={`${category.icon} ${category.name} budget`} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <MoneyField
          label="Monthly limit"
          value={amount}
          onChange={setAmount}
          autoFocus
          hint="Leave empty for no limit."
        />
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary block" disabled={busy} type="submit">
          Save
        </button>
        {category.monthly_limit_cents !== null && (
          <button type="button" className="btn ghost block" onClick={() => void save(true)}>
            Remove limit
          </button>
        )}
      </form>
    </Sheet>
  );
}
