import { ChevronRight, Heart, Receipt, Wallet, type LucideIcon } from 'lucide-react';
import { useApp, type SheetState } from '../../lib/context';
import { QuickSearch } from '../QuickSearch';
import { Sheet } from '../ui';
import { BoughtForm } from './BoughtForm';
import { ExpenseForm } from './ExpenseForm';
import { IncomeForm } from './IncomeForm';
import { WishForm } from './WishForm';

const ADD_OPTIONS: {
  kind: 'expense' | 'wish' | 'income';
  title: string;
  text: string;
  icon: LucideIcon;
  color: string;
}[] = [
  {
    kind: 'expense',
    title: 'Expense',
    text: 'Record something you paid for',
    icon: Receipt,
    color: 'var(--danger)',
  },
  {
    kind: 'wish',
    title: 'Wishlist item',
    text: 'Save something you want to buy',
    icon: Heart,
    color: 'var(--brand)',
  },
  {
    kind: 'income',
    title: 'Income',
    text: 'Salary, bonus, side job or gift',
    icon: Wallet,
    color: 'var(--savings)',
  },
];

/** Renders whichever add/edit sheet is open. */
export function SheetHost() {
  const { sheet, closeSheet, openSheet } = useApp();
  if (!sheet) return null;
  switch (sheet.kind) {
    case 'add-menu':
      return (
        <Sheet title="Add new" subtitle="What would you like to record?" onClose={closeSheet}>
          <ul className="rows" style={{ margin: '-6px -20px' }}>
            {ADD_OPTIONS.map((o) => (
              <li key={o.kind}>
                <button className="item" onClick={() => openSheet({ kind: o.kind } as SheetState)}>
                  <span
                    className="tile"
                    style={{
                      background: `color-mix(in srgb, ${o.color} 12%, transparent)`,
                      color: o.color,
                    }}
                    aria-hidden="true"
                  >
                    <o.icon size={18} />
                  </span>
                  <span className="grow">
                    <span className="item-title" style={{ display: 'block' }}>
                      {o.title}
                    </span>
                    <span className="tiny muted">{o.text}</span>
                  </span>
                  <ChevronRight size={18} className="muted" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      );
    case 'expense':
      return <ExpenseForm expense={sheet.expense} prefill={sheet.prefill} onClose={closeSheet} />;
    case 'wish':
      if (!sheet.item) {
        return (
          <Sheet
            title="Add to your wishlist"
            subtitle="Type an item, then tap Add. That is it."
            onClose={closeSheet}
          >
            <QuickSearch inline autoFocus />
          </Sheet>
        );
      }
      return <WishForm item={sheet.item} onClose={closeSheet} />;
    case 'income':
      return <IncomeForm income={sheet.income} onClose={closeSheet} />;
    case 'bought':
      return <BoughtForm item={sheet.item} onClose={closeSheet} />;
  }
}
