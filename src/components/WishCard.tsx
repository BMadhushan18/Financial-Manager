import {
  BellRing,
  CalendarCheck,
  CalendarMinus,
  CalendarPlus,
  Check,
  Pencil,
  Repeat,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { itemTotalCents } from '../../shared/finance';
import type { WishlistItem } from '../../shared/types';
import { useWishActions } from '../lib/actions';
import { useApp } from '../lib/context';
import { formatShort } from '../lib/labels';
import { Badge, Menu, type MenuItem } from './ui';

/** One wishlist item as a to-do style row: tick the circle to mark it bought. */
export function WishCard({ item }: { item: WishlistItem; score?: number; label?: string }) {
  const { fmt, openSheet, today, cycle, confirm } = useApp();
  const actions = useWishActions();
  const total = itemTotalCents(item);
  const isActive = item.status === 'IDEA' || item.status === 'PLANNED';
  const plannedNow = item.status === 'PLANNED' && item.target_cycle === cycle?.cycle.start;
  const reminderDue = isActive && item.reminder_date !== null && item.reminder_date <= today;
  const bought = item.status === 'BOUGHT';
  const dropped = item.status === 'DROPPED';

  const menu: MenuItem[] = [
    { label: 'Edit', icon: Pencil, onClick: () => openSheet({ kind: 'wish', item }) },
  ];
  if (isActive && !plannedNow) {
    menu.push({
      label: 'Plan for this month',
      icon: CalendarPlus,
      onClick: () => void actions.plan(item),
    });
  }
  if (item.status === 'IDEA') {
    menu.push({
      label: 'Plan for next month',
      icon: CalendarCheck,
      onClick: () => void actions.plan(item, 'next'),
    });
  }
  if (item.status === 'PLANNED') {
    menu.push({
      label: 'Remove from this month',
      icon: CalendarMinus,
      onClick: () => void actions.unplan(item),
    });
  }
  if (bought) {
    menu.push({
      label: 'Buy again (add back)',
      icon: Repeat,
      onClick: () => void actions.readd(item),
    });
    menu.push({
      label: 'Not bought – undo',
      icon: RotateCcw,
      divider: true,
      onClick: async () => {
        const ok = await confirm({
          title: 'Undo this purchase?',
          message: `The expense will be removed and “${item.name}” goes back to your list.`,
          confirmLabel: 'Undo purchase',
          danger: true,
        });
        if (ok) await actions.undo(item);
      },
    });
  }
  if (dropped)
    menu.push({
      label: 'Put back on the list',
      icon: RotateCcw,
      onClick: () => void actions.undo(item),
    });
  if (isActive) {
    menu.push({
      label: 'Remove – not buying',
      icon: Trash2,
      danger: true,
      divider: true,
      onClick: () => void actions.drop(item),
    });
  }

  const price = bought && item.actual_cents !== null ? item.actual_cents : total;
  const sub =
    bought && item.bought_at
      ? `Bought ${formatShort(item.bought_at)}`
      : dropped && item.dropped_at
        ? `Removed ${formatShort(item.dropped_at)}`
        : null;

  return (
    <article
      className={`todo ${bought ? 'done' : ''} ${dropped ? 'dropped' : ''}`}
      aria-label={item.name}
    >
      {isActive ? (
        <button
          type="button"
          className="check-circle"
          aria-label={`Mark “${item.name}” as bought`}
          title="Bought it"
          onClick={() => openSheet({ kind: 'bought', item })}
        >
          <Check size={16} />
        </button>
      ) : (
        <span className={`check-circle ${bought ? 'on' : 'off'}`} aria-hidden="true">
          {bought ? <Check size={16} /> : <X size={16} />}
        </span>
      )}

      <button type="button" className="todo-main" onClick={() => openSheet({ kind: 'wish', item })}>
        <span className="todo-name">
          {item.name}
          {item.quantity > 1 ? ` ×${item.quantity}` : ''}
        </span>
        {(sub || plannedNow || item.reminder_date) && (
          <span className="todo-meta">
            {sub && <span>{sub}</span>}
            {plannedNow && (
              <Badge tone="success" dot>
                This month
              </Badge>
            )}
            {isActive && item.reminder_date && (
              <Badge tone={reminderDue ? 'warning' : 'outline'}>
                <BellRing size={12} aria-hidden="true" />
                {reminderDue ? 'Reminder' : formatShort(item.reminder_date)}
              </Badge>
            )}
          </span>
        )}
      </button>

      {price > 0 && <span className="item-amount">{fmt(price)}</span>}
      <Menu label={`More for ${item.name}`} items={menu} />
    </article>
  );
}
