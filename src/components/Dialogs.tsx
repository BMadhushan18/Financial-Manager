import {
  CalendarClock,
  Hourglass,
  PiggyBank,
  ReceiptText,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import type { CheckChoice, PurchaseWarning } from '../../shared/types';
import type { ConfirmOptions, PendingPurchase } from '../lib/context';
import { Sheet } from './ui';

export function ConfirmSheet({
  options,
  onDone,
}: {
  options: ConfirmOptions;
  onDone: (ok: boolean) => void;
}) {
  const [typed, setTyped] = useState('');
  const needsTyping = Boolean(options.typeToConfirm);
  const ready = !needsTyping || typed.trim().toUpperCase() === options.typeToConfirm?.toUpperCase();
  return (
    <Sheet title={options.title} onClose={() => onDone(false)}>
      <p className="text-2 small">{options.message}</p>
      {needsTyping && (
        <div className="field" style={{ marginTop: 16 }}>
          <label htmlFor="confirm-type">
            Type <strong>{options.typeToConfirm}</strong> to confirm
          </label>
          <input
            id="confirm-type"
            className="input"
            value={typed}
            autoComplete="off"
            onChange={(e) => setTyped(e.target.value)}
          />
        </div>
      )}
      <div className="sheet-actions">
        <button
          className={`btn lg ${options.danger ? 'danger' : 'primary'}`}
          disabled={!ready}
          onClick={() => onDone(true)}
        >
          {options.confirmLabel ?? 'Confirm'}
        </button>
        <button className="btn lg" onClick={() => onDone(false)}>
          Cancel
        </button>
      </div>
    </Sheet>
  );
}

const WARNING_ICON: Record<PurchaseWarning['code'], LucideIcon> = {
  UNPAID_BILLS: ReceiptText,
  WANTS_OVER: ShoppingBag,
  SAVINGS_RISK: PiggyBank,
  SHORT: CalendarClock,
  COOLING_OFF: Hourglass,
};

/** The ONE calm sheet shown before a purchase when any check matches. */
export function PurchaseWarningSheet({
  pending,
  fmt,
}: {
  pending: PendingPurchase;
  fmt: (c: number) => string;
}) {
  const choose = (c: CheckChoice) => pending.resolve(c);
  const isNeed = pending.request.type === 'NEED';
  return (
    <Sheet
      title={isNeed ? 'A quick heads-up' : 'Before you buy'}
      subtitle={`${fmt(pending.request.amount_cents)} · ${isNeed ? 'need' : 'want'}`}
      onClose={() => choose('cancel')}
    >
      <p className="text-2 small" style={{ marginBottom: 14 }}>
        {isNeed
          ? 'This looks like a need, so it may well be the right call. Here is how it affects this cycle:'
          : 'Here is how this purchase affects your plan for this cycle. The choice is yours.'}
      </p>
      <ul className="warn-list">
        {pending.warnings.map((w) => {
          const Icon = WARNING_ICON[w.code];
          return (
            <li key={w.code}>
              <span className="tile" aria-hidden="true">
                <Icon size={16} />
              </span>
              <span>{w.message}</span>
            </li>
          );
        })}
      </ul>
      <div className="sheet-actions">
        <button className="btn primary lg" onClick={() => choose('buy')}>
          Buy anyway
        </button>
        <div className="form-grid">
          <button className="btn" onClick={() => choose('remind')}>
            Remind me in {pending.coolingDays} days
          </button>
          <button className="btn" onClick={() => choose('next_month')}>
            Move to next month
          </button>
        </div>
        <button className="btn ghost" onClick={() => choose('cancel')}>
          Cancel
        </button>
      </div>
    </Sheet>
  );
}

export interface ToastItem {
  id: number;
  message: string;
  actionLabel?: string;
  tone?: 'default' | 'error';
}

export function Toasts({
  items,
  onAction,
  onDismiss,
}: {
  items: ToastItem[];
  onAction: (id: number) => void;
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.tone === 'error' ? 'error' : ''}`}>
          <span className="grow">{t.message}</span>
          {t.actionLabel ? (
            <button onClick={() => onAction(t.id)}>{t.actionLabel}</button>
          ) : (
            <button onClick={() => onDismiss(t.id)} aria-label="Dismiss">
              OK
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
