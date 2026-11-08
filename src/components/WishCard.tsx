import { itemTotalCents } from '../../shared/finance';
import type { WishlistItem } from '../../shared/types';
import { useWishActions } from '../lib/actions';
import { useApp } from '../lib/context';
import { daysOnList, formatShort, STATUS_LABEL, URGENCY_LABEL } from '../lib/labels';
import { TypeTag } from './ui';

export function WishCard({
  item,
  score,
  label,
}: {
  item: WishlistItem;
  score?: number;
  label?: string;
}) {
  const { fmt, openSheet, today, categoryById, cycle } = useApp();
  const actions = useWishActions();
  const category = categoryById(item.category_id);
  const total = itemTotalCents(item);
  const isActive = item.status === 'IDEA' || item.status === 'PLANNED';
  const plannedNow = item.status === 'PLANNED' && item.target_cycle === cycle?.cycle.start;
  const plannedLater = item.status === 'PLANNED' && !plannedNow;

  return (
    <article className="card wish" aria-label={item.name}>
      <div className="wish-top">
        {score !== undefined && (
          <div
            className="score"
            title="Priority score (0–100)"
            aria-label={`Priority score ${score} of 100`}
          >
            {score}
          </div>
        )}
        <div className="grow">
          <div className="spread" style={{ alignItems: 'flex-start' }}>
            <button
              className="list-btn wish-name"
              style={{ minHeight: 0 }}
              onClick={() => openSheet({ kind: 'wish', item })}
              aria-label={`Edit ${item.name}`}
            >
              {category?.icon ? `${category.icon} ` : ''}
              {item.name}
              {item.quantity > 1 ? ` ×${item.quantity}` : ''}
            </button>
            <span className="amount" style={{ fontWeight: 650 }}>
              {item.status === 'BOUGHT' && item.actual_cents !== null ? (
                fmt(item.actual_cents)
              ) : total > 0 ? (
                fmt(total)
              ) : (
                <span className="muted small">No price yet</span>
              )}
            </span>
          </div>
          <div className="row wrap" style={{ marginTop: 6 }}>
            <TypeTag type={item.type} />
            {label && <span className="tag primary">{label}</span>}
            {isActive && <span className="tag neutral">{URGENCY_LABEL[item.urgency]}</span>}
            {plannedNow && <span className="tag save">✓ Planned this month</span>}
            {plannedLater && item.target_cycle && (
              <span className="tag neutral">Planned from {formatShort(item.target_cycle)}</span>
            )}
            {!isActive && <span className="tag neutral">{STATUS_LABEL[item.status]}</span>}
            {item.reminder_date && isActive && (
              <span className={`tag ${item.reminder_date <= today ? 'danger' : 'neutral'}`}>
                🔔{' '}
                {item.reminder_date <= today
                  ? 'Reminder due'
                  : `Remind ${formatShort(item.reminder_date)}`}
              </span>
            )}
          </div>
          <p className="tiny muted" style={{ marginTop: 6 }}>
            {item.status === 'BOUGHT' && item.bought_at
              ? `Bought ${formatShort(item.bought_at)}`
              : item.status === 'DROPPED' && item.dropped_at
                ? `Dropped ${formatShort(item.dropped_at)} · ${total > 0 ? `${fmt(total)} saved` : 'saved'}`
                : daysOnList(item.added_at, today)}
            {category ? ` · ${category.name}` : ''}
          </p>
        </div>
      </div>

      <div className="wish-actions">
        {item.status === 'IDEA' && (
          <button className="btn small" onClick={() => void actions.plan(item)}>
            Plan this month
          </button>
        )}
        {plannedLater && (
          <button className="btn small" onClick={() => void actions.plan(item)}>
            Plan this month
          </button>
        )}
        {plannedNow && (
          <button className="btn small" onClick={() => void actions.unplan(item)}>
            Unplan
          </button>
        )}
        {isActive && (
          <button className="btn small primary" onClick={() => openSheet({ kind: 'bought', item })}>
            Mark bought
          </button>
        )}
        {isActive && (
          <button className="btn small ghost" onClick={() => void actions.drop(item)}>
            Drop
          </button>
        )}
        {item.status === 'BOUGHT' && (
          <>
            <button className="btn small" onClick={() => void actions.readd(item)}>
              Add again
            </button>
            <UndoBought item={item} />
          </>
        )}
        {item.status === 'DROPPED' && (
          <button className="btn small" onClick={() => void actions.undo(item)}>
            Restore
          </button>
        )}
      </div>
    </article>
  );
}

function UndoBought({ item }: { item: WishlistItem }) {
  const { confirm } = useApp();
  const { undo } = useWishActions();
  return (
    <button
      className="btn small ghost"
      onClick={async () => {
        const ok = await confirm({
          title: 'Undo this purchase?',
          message: `The linked expense will be deleted and ${item.name} goes back to your list.`,
          confirmLabel: 'Undo purchase',
          danger: true,
        });
        if (ok) await undo(item);
      }}
    >
      Undo bought
    </button>
  );
}
