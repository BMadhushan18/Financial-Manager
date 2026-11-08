import {
  CalendarCheck,
  Check,
  Landmark,
  PiggyBank,
  Plus,
  ReceiptText,
  Target,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { centsToInput, parseMoneyToCents, ratioPercent } from '../../shared/finance';
import type { BillInCycle, Category, Expense, FixedBill, SavingsMode } from '../../shared/types';
import { CategoryIcon } from '../components/CategoryIcon';
import {
  Badge,
  EmptyState,
  Money,
  MoneyField,
  PanelHead,
  Segmented,
  Sheet,
  Toggle,
  TypeBadge,
} from '../components/ui';
import { WishCard } from '../components/WishCard';
import { api, errorMessage } from '../lib/api';
import { useApp } from '../lib/context';
import { useApi, useBusy } from '../lib/hooks';
import { formatShort, SOURCE_LABEL } from '../lib/labels';

export function Plan() {
  const app = useApp();
  const {
    cycle,
    fmt,
    openSheet,
    toast,
    changed,
    confirm,
    version,
    isHidden,
    deferDelete,
    categoryById,
  } = app;
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
  const savingsLeft = Math.max(t.savings_goal_cents - t.savings_moved_cents, 0);
  const allBills: FixedBill[] = app.boot?.bills ?? [];
  const pausedBills = allBills.filter((b) => !b.is_active);
  const incomes = cycle.incomes.filter((i) => !isHidden(`income:${i.id}`));
  const moves = cycle.savings.moves.filter((m) => !isHidden(`move:${m.id}`));
  const emergencyPct = ratioPercent(
    Math.max(cycle.savings.balance_cents, 0),
    cycle.savings.emergency_target_cents,
  );

  const payBill = async (b: BillInCycle) => {
    try {
      await api(`/api/fixed-bills/${b.id}/pay`, { method: 'POST', body: {} });
      toast({ message: `${b.name} marked as paid and added to expenses.` });
      changed();
    } catch (e) {
      fail(e);
    }
  };
  const unpayBill = async (b: BillInCycle) => {
    const ok = await confirm({
      title: `Mark ${b.name} as unpaid?`,
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
      {/* ---------- summary ---------- */}
      <section className="panel summary">
        <div>
          <p className="label">
            <Target size={16} aria-hidden="true" /> Remaining to spend this cycle
          </p>
          <p className={`value ${cycle.safe_to_spend_cents < 0 ? 'negative' : ''}`}>
            {fmt(cycle.safe_to_spend_cents)}
          </p>
          <p className="text-2 small">
            {formatShort(cycle.cycle.start)} – {formatShort(cycle.cycle.end)} · {cycle.days_left}{' '}
            days left
          </p>
        </div>
        <div className="breakdown">
          <span className="label">Income</span>
          <Money cents={t.income_cents} className="amount" />
          <span className="minus">Fixed bills (paid + unpaid)</span>
          <Money cents={-t.bills_committed_cents} className="amount muted" />
          <span className="minus">Savings (moved + to move)</span>
          <Money cents={-(t.savings_moved_cents + savingsLeft)} className="amount muted" />
          <span className="minus">Planned purchases</span>
          <Money cents={-t.reserved_cents} className="amount muted" />
          <span className="minus">Other spending</span>
          <Money cents={-t.other_expenses_cents} className="amount muted" />
          <span className="total">Remaining</span>
          <span className={`total amount num ${cycle.safe_to_spend_cents < 0 ? 'neg' : ''}`}>
            {fmt(cycle.safe_to_spend_cents)}
          </span>
        </div>
      </section>

      <div className="grid grid-2">
        {/* ---------- income ---------- */}
        <section className="panel">
          <PanelHead
            title="Income"
            icon={Wallet}
            subtitle={`${fmt(t.income_received_cents)} received · ${fmt(t.income_expected_cents)} expected`}
            action={
              <button className="btn sm" onClick={() => openSheet({ kind: 'income' })}>
                <Plus size={15} /> Add
              </button>
            }
          />
          {incomes.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No income this cycle"
              text="Add your salary here, or set it in Settings so it appears every cycle."
            />
          ) : (
            <ul className="rows">
              {incomes.map((i) => (
                <li key={i.id} className="row" style={{ paddingRight: 16 }}>
                  <button className="item" onClick={() => openSheet({ kind: 'income', income: i })}>
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="item-title ellipsis" style={{ display: 'block' }}>
                        {i.note || SOURCE_LABEL[i.source]}
                      </span>
                      <span className="item-meta">
                        {SOURCE_LABEL[i.source]} · {formatShort(i.date)}
                        <Badge
                          tone={i.status === 'received' ? 'success' : 'outline'}
                          dot={i.status === 'received'}
                        >
                          {i.status === 'received' ? 'Received' : 'Expected'}
                        </Badge>
                      </span>
                    </span>
                    <Money cents={i.amount_cents} className="item-amount" />
                  </button>
                  {i.status === 'expected' && (
                    <button
                      className="btn sm"
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
                      <Check size={15} /> Received
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------- bills ---------- */}
        <section className="panel">
          <PanelHead
            title="Fixed bills"
            icon={ReceiptText}
            subtitle={`${fmt(t.bills_paid_cents)} paid · ${fmt(t.bills_unpaid_cents)} to pay`}
            action={
              <button className="btn sm" onClick={() => setBillSheet('new')}>
                <Plus size={15} /> Add
              </button>
            }
          />
          {cycle.bills.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="No fixed bills"
              text="Add rent, loans, phone and subscriptions. They repeat every cycle."
            />
          ) : (
            <ul className="rows">
              {cycle.bills.map((b) => {
                const cat = categoryById(b.category_id);
                return (
                  <li key={b.id} className="row" style={{ paddingRight: 16 }}>
                    <button
                      className="item"
                      onClick={() => setBillSheet(allBills.find((x) => x.id === b.id) ?? null)}
                    >
                      <CategoryIcon
                        icon={cat?.icon}
                        name={cat?.name ?? b.name}
                        color={cat?.color}
                        size="sm"
                      />
                      <span className="grow" style={{ minWidth: 0 }}>
                        <span className="item-title ellipsis" style={{ display: 'block' }}>
                          {b.name}
                        </span>
                        <span className="item-meta">
                          <TypeBadge type={b.type} />
                          {b.is_paid && b.paid_at
                            ? `Paid ${formatShort(b.paid_at)}`
                            : `Due ${formatShort(b.due_date)}`}
                        </span>
                      </span>
                      <Money
                        cents={b.is_paid ? (b.paid_cents ?? b.amount_cents) : b.amount_cents}
                        className="item-amount"
                      />
                    </button>
                    {b.is_paid ? (
                      <button
                        className="btn sm ghost"
                        style={{ color: 'var(--savings-text)' }}
                        onClick={() => void unpayBill(b)}
                        aria-label={`${b.name} is paid. Mark as unpaid`}
                      >
                        <Check size={15} /> Paid
                      </button>
                    ) : (
                      <button className="btn sm" onClick={() => void payBill(b)}>
                        Pay
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {pausedBills.length > 0 && (
            <div className="panel-foot row wrap small">
              <span className="muted">Paused:</span>
              {pausedBills.map((b) => (
                <button key={b.id} className="btn sm ghost" onClick={() => setBillSheet(b)}>
                  {b.name}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ---------- savings ---------- */}
        <section className="panel">
          <PanelHead
            title="Savings"
            icon={PiggyBank}
            subtitle="Pay yourself first – set aside like a bill"
            action={
              <button className="btn sm" onClick={() => setGoalSheet(true)}>
                Edit goal
              </button>
            }
          />
          <div className="panel-body stack">
            <div className="stats">
              <div className="stat">
                <div className="label">Goal this cycle</div>
                <div className="value">{fmt(t.savings_goal_cents)}</div>
                <div className="sub">
                  {cycle.savings.goal.mode === 'percent'
                    ? `${cycle.savings.goal.percent}% of income`
                    : 'Fixed amount'}
                </div>
              </div>
              <div className="stat">
                <div className="label">Moved so far</div>
                <div className="value pos">{fmt(t.savings_moved_cents)}</div>
                <div className="sub">
                  {savingsLeft > 0 ? `${fmt(savingsLeft)} to go` : 'Goal reached'}
                </div>
              </div>
            </div>
            <div className="progress">
              <div className="spread small">
                <span className="strong">Emergency fund</span>
                <span className="num muted">
                  {fmt(cycle.savings.balance_cents)} of {fmt(cycle.savings.emergency_target_cents)}
                </span>
              </div>
              <div
                className="track"
                role="progressbar"
                aria-label="Emergency fund progress"
                aria-valuenow={emergencyPct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="fill"
                  style={{ width: `${Math.min(emergencyPct, 100)}%`, background: 'var(--savings)' }}
                />
              </div>
              <span className="tiny muted">{emergencyPct}% of target</span>
            </div>
            <button className="btn block" onClick={() => setMoveSheet(true)}>
              <Landmark size={16} /> Move money to savings
            </button>
          </div>
          {moves.length > 0 && (
            <ul className="rows" style={{ borderTop: '1px solid var(--border)' }}>
              {moves.map((m) => (
                <li key={m.id} className="item" style={{ minHeight: 52 }}>
                  <span className="grow small">
                    {m.note || (m.amount_cents > 0 ? 'Moved to savings' : 'Taken from savings')}
                    <span className="tiny muted"> · {formatShort(m.date)}</span>
                  </span>
                  <Money
                    cents={m.amount_cents}
                    signed
                    className={`item-amount ${m.amount_cents > 0 ? 'pos' : 'neg'}`}
                  />
                  <button
                    className="icon-btn sm"
                    aria-label="Delete this savings entry"
                    onClick={() =>
                      deferDelete(`move:${m.id}`, 'Savings entry deleted.', () =>
                        api(`/api/savings/moves/${m.id}`, { method: 'DELETE', keepalive: true }),
                      )
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------- planned ---------- */}
        <section className="panel">
          <PanelHead
            title="Planned purchases"
            icon={CalendarCheck}
            subtitle={`${fmt(t.reserved_cents)} set aside this cycle`}
            action={
              <a className="btn sm" href="#/wishlist">
                Wishlist
              </a>
            }
          />
          {cycle.planned.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title="Nothing planned"
              text="Plan wishlist items for this month to set their price aside."
            />
          ) : (
            <div>
              {cycle.planned.map((item) => (
                <WishCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ---------- category budgets ---------- */}
      <section className="panel">
        <PanelHead
          title="Category budgets"
          icon={Target}
          subtitle="Optional monthly limits. Select a category to set one."
        />
        <ul className="rows">
          {app.activeCategories.map((c) => {
            const spent = spentByCategory.get(c.id) ?? 0;
            const limit = c.monthly_limit_cents;
            const pct = limit ? ratioPercent(spent, limit) : 0;
            return (
              <li key={c.id}>
                <button className="item" onClick={() => setLimitFor(c)}>
                  <CategoryIcon icon={c.icon} name={c.name} color={c.color} size="sm" />
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="item-title">{c.name}</span>
                      <span className="num small">
                        <strong>{fmt(spent)}</strong>
                        {limit ? (
                          <span className="muted"> / {fmt(limit)}</span>
                        ) : (
                          <span className="muted"> · no limit</span>
                        )}
                      </span>
                    </span>
                    {limit ? (
                      <span className="track" style={{ display: 'block', marginTop: 8, height: 6 }}>
                        <span
                          className="fill"
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
                    ) : null}
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
      {moveSheet && <MoveSheet onClose={() => setMoveSheet(false)} suggested={savingsLeft} />}
      {limitFor && <LimitSheet category={limitFor} onClose={() => setLimitFor(null)} />}
    </div>
  );
}

/* ---------------- sheets ---------------- */

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
        return setError('Due day must be between 1 and 31.');
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
    <Sheet
      title={bill ? 'Edit bill' : 'New fixed bill'}
      subtitle="Repeats every cycle"
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
        <div className="form-grid">
          <MoneyField label="Amount" value={amount} onChange={setAmount} />
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
        </div>
        <div className="field">
          <label htmlFor="bill-cat">Category</label>
          <select
            id="bill-cat"
            className="input"
            value={categoryId ?? ''}
            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">None (counted as a need)</option>
            {activeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {bill && (
          <Toggle
            label="Active"
            description="Inactive bills are paused and not counted."
            checked={active}
            onChange={setActive}
          />
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary lg block" disabled={busy} type="submit">
          {bill ? 'Save changes' : 'Add bill'}
        </button>
        {bill && (
          <button type="button" className="btn danger-ghost block" onClick={() => void remove()}>
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
        return setError('Percent must be between 0 and 100.');
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
    <Sheet title="Savings goal" subtitle="How much to set aside each cycle" onClose={onClose}>
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
            { value: 'percent', label: 'Percent of income' },
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
        <button className="btn primary lg block" disabled={busy} type="submit">
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
        toast({ message: direction === 'in' ? 'Moved to savings.' : 'Withdrawal recorded.' });
        changed();
        onClose();
      } catch (e) {
        setError(errorMessage(e));
      }
    });
  return (
    <Sheet title="Savings transfer" onClose={onClose}>
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
            { value: 'in', label: 'Deposit to savings' },
            { value: 'out', label: 'Withdraw' },
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
        <button className="btn primary lg block" disabled={busy} type="submit">
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
    <Sheet title={`${category.name} budget`} subtitle="Monthly spending limit" onClose={onClose}>
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
        <button className="btn primary lg block" disabled={busy} type="submit">
          Save budget
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
