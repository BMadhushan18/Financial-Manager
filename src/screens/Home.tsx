import {
  ArrowDownRight,
  ArrowUpRight,
  BellRing,
  CalendarClock,
  CircleAlert,
  Heart,
  PiggyBank,
  Receipt,
  ShieldCheck,
  Target,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import type { BillInCycle, Expense } from '../../shared/types';
import { CategoryIcon } from '../components/CategoryIcon';
import { ItemThumb } from '../components/ItemThumb';
import { QuickSearch } from '../components/QuickSearch';
import { Badge, EmptyState, Money, PanelHead, ProgressBar, TypeBadge } from '../components/ui';
import { WishCard } from '../components/WishCard';
import { api, errorMessage } from '../lib/api';
import { useApp } from '../lib/context';
import { useApi } from '../lib/hooks';
import { formatShort, relativeDay } from '../lib/labels';

export function Home() {
  const app = useApp();
  const { cycle, fmt, openSheet, toast, changed, today, version, categoryById, isHidden } = app;
  const recent = useApi<{ expenses: Expense[] }>(
    cycle ? `/api/expenses?from=${cycle.cycle.start}&to=${cycle.cycle.end}` : null,
    [version],
  );
  if (!cycle) return null;
  const t = cycle.totals;
  const safe = cycle.safe_to_spend_cents;
  const negative = safe < 0;
  const until =
    app.boot?.settings.cycle_mode === 'calendar' ? 'until month end' : 'until salary day';
  const spent = t.needs_spent_cents + t.wants_spent_cents;
  const savingsLeft = Math.max(t.savings_goal_cents - t.savings_moved_cents, 0);
  const recentItems = (recent.data?.expenses ?? [])
    .filter((e) => !isHidden(`expense:${e.id}`))
    .slice(0, 6);

  return (
    <div className="stack">
      <div className="hide-desktop">
        <QuickSearch />
      </div>
      {/* ---------- headline ---------- */}
      <section className="panel summary" aria-labelledby="safe-label">
        <div>
          <p className="label" id="safe-label">
            <ShieldCheck size={16} aria-hidden="true" /> Safe to spend
          </p>
          <p className={`value ${negative ? 'negative' : ''}`} aria-live="polite">
            {fmt(safe)}
          </p>
          <p className="text-2 small">
            {negative ? (
              <>
                You are {fmt(-safe)} short {until}.
              </>
            ) : (
              <>
                About <strong className="num">{fmt(cycle.safe_per_day_cents)}</strong> per day for
                the next {cycle.days_left} {cycle.days_left === 1 ? 'day' : 'days'}
              </>
            )}
          </p>
          {negative && (
            <div className="callout warning" style={{ marginTop: 14 }}>
              <CircleAlert size={16} />
              <span>
                That happens. Pausing a want or moving a planned item to next month will bring this
                back up.
              </span>
            </div>
          )}
        </div>
        <div className="breakdown" aria-label="How safe to spend is calculated">
          <span className="label">Income (received + expected)</span>
          <Money cents={t.income_cents} className="amount" />
          <span className="minus">Fixed bills</span>
          <Money cents={-t.bills_committed_cents} className="amount muted" />
          <span className="minus">Savings goal</span>
          <Money cents={-(t.savings_moved_cents + savingsLeft)} className="amount muted" />
          <span className="minus">Planned purchases</span>
          <Money cents={-t.reserved_cents} className="amount muted" />
          <span className="minus">Other spending</span>
          <Money cents={-t.other_expenses_cents} className="amount muted" />
          <span className="total">Safe to spend</span>
          <span className={`total amount num ${negative ? 'neg' : ''}`}>{fmt(safe)}</span>
        </div>
      </section>

      {/* ---------- KPIs ---------- */}
      <section className="kpis" aria-label="This cycle at a glance">
        <div className="panel kpi">
          <span className="kpi-label">
            <ArrowDownRight size={15} aria-hidden="true" /> Income
          </span>
          <span className="kpi-value">{fmt(t.income_cents)}</span>
          <span className="kpi-sub">
            {t.income_expected_cents > 0
              ? `${fmt(t.income_expected_cents)} still expected`
              : 'All received'}
          </span>
        </div>
        <div className="panel kpi">
          <span className="kpi-label">
            <ArrowUpRight size={15} aria-hidden="true" /> Spent
          </span>
          <span className="kpi-value">{fmt(spent)}</span>
          <span className="kpi-sub">Needs, wants and paid bills</span>
        </div>
        <div className="panel kpi">
          <span className="kpi-label">
            <PiggyBank size={15} aria-hidden="true" /> Saved
          </span>
          <span className="kpi-value pos">{fmt(t.savings_moved_cents)}</span>
          <span className="kpi-sub">
            {savingsLeft > 0 ? `${fmt(savingsLeft)} to reach goal` : 'Goal reached'}
          </span>
        </div>
        <div className="panel kpi">
          <span className="kpi-label">
            <CalendarClock size={15} aria-hidden="true" /> Bills to pay
          </span>
          <span className="kpi-value">{fmt(t.bills_unpaid_cents)}</span>
          <span className="kpi-sub">
            {cycle.bills.filter((b) => !b.is_paid).length} unpaid this cycle
          </span>
        </div>
      </section>

      <div className="grid grid-main">
        {/* ---------- left column ---------- */}
        <div className="stack">
          <section className="panel" aria-labelledby="plan-h">
            <div className="panel-head">
              <div>
                <h2 id="plan-h">
                  <Target size={18} aria-hidden="true" /> Budget vs plan
                </h2>
                <p>
                  {app.boot!.settings.split_needs}/{app.boot!.settings.split_wants}/
                  {app.boot!.settings.split_savings} split of this cycle's income
                </p>
              </div>
              <a href="#/plan" className="btn sm">
                View plan
              </a>
            </div>
            <div className="panel-body stack">
              <ProgressBar label="Needs" data={cycle.progress.needs} color="var(--needs)" />
              <ProgressBar label="Wants" data={cycle.progress.wants} color="var(--wants)" />
              <ProgressBar label="Savings" data={cycle.progress.savings} color="var(--savings)" />
            </div>
          </section>

          <section className="panel" aria-labelledby="top-h">
            <PanelHead
              title="Top wishlist priorities"
              icon={Heart}
              subtitle="Ranked by need, urgency, your priority and whether it fits"
              action={
                <a href="#/wishlist" className="btn sm">
                  View all
                </a>
              }
            />
            {cycle.top_wishes.length === 0 ? (
              <EmptyState
                icon={Heart}
                title="Your wishlist is empty"
                text="Add things you would like to buy. MoneyMind helps you decide when."
                action={
                  <button className="btn primary" onClick={() => openSheet({ kind: 'wish' })}>
                    Add an item
                  </button>
                }
              />
            ) : (
              <div>
                {cycle.top_wishes.map((w) => (
                  <WishCard key={w.item.id} item={w.item} score={w.score} label={w.label} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ---------- right column ---------- */}
        <div className="stack">
          {cycle.reminders.length > 0 && (
            <section className="panel" aria-labelledby="rem-h">
              <PanelHead title="Reminders" icon={BellRing} subtitle="You asked to revisit these" />
              <ul className="rows">
                {cycle.reminders.map((item) => {
                  const cat = categoryById(item.category_id);
                  return (
                    <li key={item.id}>
                      <button className="item" onClick={() => openSheet({ kind: 'bought', item })}>
                        <ItemThumb name={item.name} category={cat} size={40} />
                        <span className="grow">
                          <span className="item-title" style={{ display: 'block' }}>
                            {item.name}
                          </span>
                          <span className="item-meta">Still want it? Tap to decide.</span>
                        </span>
                        <Badge tone="warning">Due</Badge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="panel" aria-labelledby="bills-h">
            <PanelHead
              title="Upcoming bills"
              icon={CalendarClock}
              subtitle="Unpaid, due in the next 7 days"
            />
            {cycle.upcoming_bills.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="Nothing due this week" text="All caught up." />
            ) : (
              <ul className="rows">
                {cycle.upcoming_bills.map((b) => (
                  <BillRow
                    key={b.id}
                    bill={b}
                    today={today}
                    onPaid={changed}
                    onError={(m) => toast({ message: m, tone: 'error' })}
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="panel" aria-labelledby="recent-h">
            <PanelHead
              title="Recent expenses"
              icon={Receipt}
              action={
                <a href="#/expenses" className="btn sm">
                  View all
                </a>
              }
            />
            {recentItems.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No expenses yet"
                text="Add one in a few seconds with the Add button."
              />
            ) : (
              <ul className="rows">
                {recentItems.map((e) => {
                  const cat = categoryById(e.category_id);
                  return (
                    <li key={e.id}>
                      <button
                        className="item"
                        onClick={() => openSheet({ kind: 'expense', expense: e })}
                      >
                        <ItemThumb name={e.note} category={cat} size={36} />
                        <span className="grow" style={{ minWidth: 0 }}>
                          <span className="item-title ellipsis" style={{ display: 'block' }}>
                            {e.note || cat?.name || 'Expense'}
                          </span>
                          <span className="item-meta">
                            {e.date === today ? 'Today' : formatShort(e.date)}
                            <TypeBadge type={e.type} />
                          </span>
                        </span>
                        <Money
                          cents={e.amount_cents}
                          className={`item-amount ${e.amount_cents < 0 ? 'pos' : ''}`}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      <p className="disclaimer">
        MoneyMind provides guidance, not financial advice. You always decide.
      </p>
    </div>
  );
}

function BillRow({
  bill,
  today,
  onPaid,
  onError,
}: {
  bill: BillInCycle;
  today: string;
  onPaid: () => void;
  onError: (m: string) => void;
}) {
  const { categoryById } = useApp();
  const [busy, setBusy] = useState(false);
  const overdue = bill.due_date < today;
  const cat = categoryById(bill.category_id);
  return (
    <li className="item">
      <CategoryIcon icon={cat?.icon} name={cat?.name ?? bill.name} color={cat?.color} size="sm" />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="item-title ellipsis">{bill.name}</div>
        <div className={`item-meta ${overdue ? 'neg' : ''}`}>
          {overdue
            ? `Overdue since ${formatShort(bill.due_date)}`
            : `Due ${relativeDay(bill.due_date, today).toLowerCase()}`}
        </div>
      </div>
      <Money cents={bill.amount_cents} className="item-amount" />
      <button
        className="btn sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api(`/api/fixed-bills/${bill.id}/pay`, { method: 'POST', body: {} });
            onPaid();
          } catch (e) {
            onError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        Pay
      </button>
    </li>
  );
}
