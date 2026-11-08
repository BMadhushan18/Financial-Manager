import {
  BellRing,
  CalendarCheck,
  CalendarMinus,
  CalendarPlus,
  Pencil,
  RotateCcw,
  Repeat,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import { itemTotalCents } from '../../shared/finance';
import type { WishlistItem } from '../../shared/types';
import { useWishActions } from '../lib/actions';
import { useApp } from '../lib/context';
import { daysOnList, formatShort, URGENCY_LABEL } from '../lib/labels';
import { CategoryIcon } from './CategoryIcon';
import { Badge, Menu, TypeBadge, type MenuItem } from './ui';

/** One wishlist item as a row inside a panel. */
export function WishCard({
  item,
  score,
  label,
}: {
  item: WishlistItem;
  score?: number;
  label?: string;
}) {
  const { fmt, openSheet, today, categoryById, cycle, confirm } = useApp();
  const actions = useWishActions();
  const category = categoryById(item.category_id);
  const total = itemTotalCents(item);
  const isActive = item.status === 'IDEA' || item.status === 'PLANNED';
  const plannedNow = item.status === 'PLANNED' && item.target_cycle === cycle?.cycle.start;
  const plannedLater = item.status === 'PLANNED' && !plannedNow;
  const reminderDue = isActive && item.reminder_date !== null && item.reminder_date <= today;

  const menu: MenuItem[] = [];
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
      label: 'Move back to ideas',
      icon: CalendarMinus,
      onClick: () => void actions.unplan(item),
    });
  }
  menu.push({
    label: 'Edit details',
    icon: Pencil,
    onClick: () => openSheet({ kind: 'wish', item }),
  });
  if (item.status === 'BOUGHT') {
    menu.push({
      label: 'Undo purchase',
      icon: RotateCcw,
      divider: true,
      onClick: async () => {
        const ok = await confirm({
          title: 'Undo this purchase?',
          message: `The linked expense will be deleted and "${item.name}" returns to your list.`,
          confirmLabel: 'Undo purchase',
          danger: true,
        });
        if (ok) await actions.undo(item);
      },
    });
  }
  if (isActive) {
    menu.push({
      label: 'Drop – not buying',
      icon: Trash2,
      danger: true,
      divider: true,
      onClick: () => void actions.drop(item),
    });
  }

  const priceCents =
    item.status === 'BOUGHT' && item.actual_cents !== null ? item.actual_cents : total;
  const metaParts = [
    category?.name,
    item.status === 'BOUGHT' && item.bought_at
      ? `Bought ${formatShort(item.bought_at)}`
      : item.status === 'DROPPED' && item.dropped_at
        ? `Dropped ${formatShort(item.dropped_at)}`
        : daysOnList(item.added_at, today),
    item.quantity > 1 ? `Qty ${item.quantity}` : null,
  ].filter(Boolean);

  return (
    <article className="wish" aria-label={item.name}>
      {score !== undefined ? (
        <div
          className={`score ${score >= 70 ? 'high' : ''}`}
          title="Priority score (0–100)"
          aria-label={`Priority score ${score} of 100`}
        >
          {score}
        </div>
      ) : (
        <CategoryIcon
          icon={category?.icon}
          name={category?.name ?? item.name}
          color={category?.color}
        />
      )}

      <div className="wish-body">
        <button className="wish-title" onClick={() => openSheet({ kind: 'wish', item })}>
          {item.name}
        </button>
        <div className="item-meta">{metaParts.join(' · ')}</div>
        <div className="wish-badges">
          <TypeBadge type={item.type} />
          {label && <Badge tone="brand">{label}</Badge>}
          {isActive && <Badge tone="outline">{URGENCY_LABEL[item.urgency]}</Badge>}
          {plannedNow && (
            <Badge tone="success" dot>
              Planned this month
            </Badge>
          )}
          {plannedLater && item.target_cycle && (
            <Badge tone="outline">Planned from {formatShort(item.target_cycle)}</Badge>
          )}
          {item.status === 'DROPPED' && total > 0 && (
            <Badge tone="success">{fmt(total)} saved</Badge>
          )}
          {isActive && item.reminder_date && (
            <Badge tone={reminderDue ? 'warning' : 'outline'}>
              <BellRing size={12} aria-hidden="true" />
              {reminderDue ? 'Reminder due' : `Remind ${formatShort(item.reminder_date)}`}
            </Badge>
          )}
        </div>
      </div>

      <div className="wish-side">
        <div className="row" style={{ gap: 2 }}>
          <span className="item-amount">
            {priceCents > 0 ? fmt(priceCents) : <span className="muted small">No price</span>}
          </span>
          <Menu label={`More actions for ${item.name}`} items={menu} />
        </div>
        {isActive && (
          <button className="btn sm primary" onClick={() => openSheet({ kind: 'bought', item })}>
            <ShoppingBag size={15} /> Mark bought
          </button>
        )}
        {item.status === 'BOUGHT' && (
          <button className="btn sm" onClick={() => void actions.readd(item)}>
            <Repeat size={15} /> Add again
          </button>
        )}
        {item.status === 'DROPPED' && (
          <button className="btn sm" onClick={() => void actions.undo(item)}>
            <RotateCcw size={15} /> Restore
          </button>
        )}
      </div>
    </article>
  );
}
