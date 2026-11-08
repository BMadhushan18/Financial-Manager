import { useEffect, useId, useRef, type ReactNode } from 'react';
import type { EntryType, ProgressBarData } from '../../shared/types';
import { useApp } from '../lib/context';
import { Icon } from './Icon';

/** Formatted money that respects privacy mode. */
export function Money({
  cents,
  className,
  signed,
}: {
  cents: number;
  className?: string;
  signed?: boolean;
}) {
  const { fmt } = useApp();
  const text = fmt(cents);
  return (
    <span className={`amount ${className ?? ''}`}>{signed && cents > 0 ? `+${text}` : text}</span>
  );
}

/** NEED / WANT tag: colour + icon + text (never colour alone). */
export function TypeTag({ type }: { type: EntryType }) {
  return type === 'NEED' ? (
    <span className="tag need">
      <span aria-hidden="true">●</span> Need
    </span>
  ) : (
    <span className="tag want">
      <span aria-hidden="true">★</span> Want
    </span>
  );
}

export function ProgressBar({
  label,
  data,
  color,
  icon,
}: {
  label: string;
  data: ProgressBarData;
  color: string;
  icon: string;
}) {
  const { fmt } = useApp();
  const width = Math.min(data.percent, 100);
  const over = data.over_cents > 0;
  return (
    <div className="progress">
      <div className="spread small">
        <span>
          <span aria-hidden="true">{icon}</span> <strong>{label}</strong>
        </span>
        <span className="amount muted">
          {fmt(data.actual_cents)} of {fmt(data.plan_cents)}
        </span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={`${label}: ${data.percent}% of plan`}
        aria-valuenow={data.percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`progress-fill ${over ? 'over' : ''}`}
          style={{ width: `${width}%`, background: color }}
        />
      </div>
      <span className={`tiny ${over ? 'soft-red' : 'muted'}`}>
        {over
          ? `You are ${fmt(data.over_cents)} over your ${label.toLowerCase()} plan`
          : `${data.percent}% used`}
      </span>
    </div>
  );
}

export function Skeleton({
  height = 20,
  width = '100%',
}: {
  height?: number;
  width?: number | string;
}) {
  return <div className="skeleton" style={{ height, width }} aria-hidden="true" />;
}

export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div className="card" key={i}>
          <Skeleton height={18} width="40%" />
          <div style={{ height: 10 }} />
          <Skeleton height={14} />
          <div style={{ height: 6 }} />
          <Skeleton height={14} width="70%" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  emoji,
  title,
  text,
  action,
}: {
  emoji: string;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="emoji" aria-hidden="true">
        {emoji}
      </span>
      <strong>{title}</strong>
      {text && <p className="muted small">{text}</p>}
      {action}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-box" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button className="btn small" style={{ marginTop: 8 }} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

/** Accessible bottom sheet (dialog). Esc or backdrop tap closes it. */
export function Sheet({
  title,
  onClose,
  children,
  labelledBy,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>(
      '[autofocus], input, select, textarea, button:not(.icon-btn)',
    );
    (first ?? node)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab' && node) {
        const items = node.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])',
        );
        if (items.length === 0) return;
        const a = items[0]!;
        const z = items[items.length - 1]!;
        if (e.shiftKey && document.activeElement === a) {
          z.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === z) {
          a.focus();
          e.preventDefault();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? titleId}
        ref={ref}
        tabIndex={-1}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-head">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function MoneyField({
  label,
  value,
  onChange,
  error,
  autoFocus,
  hint,
  big,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  autoFocus?: boolean;
  hint?: string;
  big?: boolean;
}) {
  const id = useId();
  const { currency } = useApp();
  return (
    <div className="field">
      <label htmlFor={id}>
        {label} <span className="muted">({currency})</span>
      </label>
      <input
        id={id}
        className={`input ${big ? 'money' : ''}`}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={value}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && !error && (
        <span className="hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field-error" id={`${id}-err`}>
          {error}
        </span>
      )}
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="segmented" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: (id: string) => ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}
