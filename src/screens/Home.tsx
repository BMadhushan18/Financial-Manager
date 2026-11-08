import { useState } from 'react';
import { ProgressBar, Money, EmptyState } from '../components/ui';
import { WishCard } from '../components/WishCard';
import { api, errorMessage } from '../lib/api';
import { useApp } from '../lib/context';
import { formatShort, relativeDay } from '../lib/labels';
import type { BillInCycle } from '../../shared/types';

export function Home() {
  const app = useApp();
  const { cycle, fmt, openSheet, toast, changed, today } = app;
  if (!cycle) return null;
  const safe = cycle.safe_to_spend_cents;
  const negative = safe < 0;
  const untilLabel =
    app.boot?.settings.cycle_mode === 'calendar'
      ? 'until the end of the month'
      : 'until salary day';

  return (
    <div className="stack">
      <section className={`card hero ${negative ? 'negative' : ''}`} aria-labelledby="safe-label">
        <p className="label" id="safe-label">
          Safe to spend
        </p>
        <p className="big" aria-live="polite">
          {fmt(safe)}
        </p>
        <p className="sub">
          {negative ? (
            <>
              You are {fmt(-safe)} short {untilLabel}.
            </>
          ) : (
            <>
              About <strong>{fmt(cycle.safe_per_day_cents)}</strong> a day for the next{' '}
              {cycle.days_left} {cycle.days_left === 1 ? 'day' : 'days'}
            </>
          )}
        </p>
        <p className="hero-note">
          {negative
            ? 'That is okay – it happens. Pausing a want or moving a planned item to next month will bring this back up.'
            : `Cycle ${formatShort(cycle.cycle.start)} – ${formatShort(cycle.cycle.end)}. Bills, savings and planned buys are already set aside.`}
        </p>
      </section>

      {cycle.reminders.length > 0 && (
        <section className="card" aria-labelledby="rem-h">
          <div className="card-head">
            <h2 id="rem-h">🔔 Reminders</h2>
          </div>
          <p className="small muted" style={{ marginBottom: 8 }}>
            You asked to think about these again. Still want them?
          </p>
          <div className="stack" style={{ gap: 8 }}>
            {cycle.reminders.map((item) => (
              <WishCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      <section className="card stack" aria-labelledby="plan-h" style={{ gap: 14 }}>
        <div className="spread">
          <h2 id="plan-h">This cycle vs plan</h2>
          <a href="#/plan" className="small">
            See plan
          </a>
        </div>
        <ProgressBar label="Needs" icon="●" data={cycle.progress.needs} color="var(--needs)" />
        <ProgressBar label="Wants" icon="★" data={cycle.progress.wants} color="var(--wants)" />
        <ProgressBar
          label="Savings"
          icon="🌱"
          data={cycle.progress.savings}
          color="var(--savings)"
        />
      </section>

      <section className="card" aria-labelledby="bills-h">
        <div className="card-head">
          <h2 id="bills-h">Upcoming bills</h2>
          <span className="tiny muted">next 7 days</span>
        </div>
        {cycle.upcoming_bills.length === 0 ? (
          <EmptyState emoji="✅" title="No bills due this week" text="Enjoy the calm." />
        ) : (
          <ul className="list">
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

      <section aria-labelledby="top-h" className="stack" style={{ gap: 10 }}>
        <div className="spread">
          <h2 id="top-h">Top wishes</h2>
          <a href="#/wishlist" className="small">
            All wishes
          </a>
        </div>
        {cycle.top_wishes.length === 0 ? (
          <div className="card">
            <EmptyState
              emoji="💜"
              title="Your wishlist is empty"
              text="Add things you want to buy. We will help you decide when."
              action={
                <button className="btn primary" onClick={() => openSheet({ kind: 'wish' })}>
                  Add a wish
                </button>
              }
            />
          </div>
        ) : (
          cycle.top_wishes.map((w) => (
            <WishCard key={w.item.id} item={w.item} score={w.score} label={w.label} />
          ))
        )}
      </section>

      <p className="tiny muted" style={{ textAlign: 'center' }}>
        MoneyMind gives guidance, not financial advice. You always decide.
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
  const [busy, setBusy] = useState(false);
  const overdue = bill.due_date < today;
  return (
    <li>
      <div className="grow">
        <div className="ellipsis">{bill.name}</div>
        <div className={`tiny ${overdue ? 'soft-red' : 'muted'}`}>
          {overdue
            ? `Was due ${formatShort(bill.due_date)}`
            : `Due ${relativeDay(bill.due_date, today).toLowerCase()}`}
        </div>
      </div>
      <Money cents={bill.amount_cents} />
      <button
        className="btn small"
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
