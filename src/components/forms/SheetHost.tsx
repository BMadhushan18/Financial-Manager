import { useApp } from '../../lib/context';
import { Sheet } from '../ui';
import { BoughtForm } from './BoughtForm';
import { ExpenseForm } from './ExpenseForm';
import { IncomeForm } from './IncomeForm';
import { WishForm } from './WishForm';

/** Renders whichever add/edit sheet is open. */
export function SheetHost() {
  const { sheet, closeSheet, openSheet } = useApp();
  if (!sheet) return null;
  switch (sheet.kind) {
    case 'add-menu':
      return (
        <Sheet title="Add" onClose={closeSheet}>
          <div className="stack" style={{ gap: 8 }}>
            <button
              className="btn block"
              style={{ justifyContent: 'flex-start', minHeight: 60 }}
              onClick={() => openSheet({ kind: 'expense' })}
            >
              <span aria-hidden="true">💸</span> Add expense
              <span className="muted small" style={{ marginLeft: 'auto' }}>
                Something you paid
              </span>
            </button>
            <button
              className="btn block"
              style={{ justifyContent: 'flex-start', minHeight: 60 }}
              onClick={() => openSheet({ kind: 'wish' })}
            >
              <span aria-hidden="true">💜</span> Add wish
              <span className="muted small" style={{ marginLeft: 'auto' }}>
                Something you want to buy
              </span>
            </button>
            <button
              className="btn block"
              style={{ justifyContent: 'flex-start', minHeight: 60 }}
              onClick={() => openSheet({ kind: 'income' })}
            >
              <span aria-hidden="true">💰</span> Add income
              <span className="muted small" style={{ marginLeft: 'auto' }}>
                Salary, bonus, gift…
              </span>
            </button>
          </div>
        </Sheet>
      );
    case 'expense':
      return <ExpenseForm expense={sheet.expense} onClose={closeSheet} />;
    case 'wish':
      return <WishForm item={sheet.item} onClose={closeSheet} />;
    case 'income':
      return <IncomeForm income={sheet.income} onClose={closeSheet} />;
    case 'bought':
      return <BoughtForm item={sheet.item} onClose={closeSheet} />;
  }
}
