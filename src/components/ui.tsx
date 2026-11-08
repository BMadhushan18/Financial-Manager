import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  MoreHorizontal,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { EntryType, ProgressBarData } from '../../shared/types';
import { currencySymbol } from '../../shared/finance';
import { useApp } from '../lib/context';

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
    <span className={`num ${className ?? ''}`}>{signed && cents > 0 ? `+${text}` : text}</span>
  );
}

/** NEED / WANT badge: colour + text (never colour alone). */
export function TypeBadge({ type }: { type: EntryType }) {
  return (
    <span className={`badge ${type === 'NEED' ? 'need' : 'want'}`}>
      <span className="dot" aria-hidden="true" />
      {type === 'NEED' ? 'Need' : 'Want'}
    </span>
  );
}

export function Badge({
  tone,
  children,
  dot,
}: {
  tone?: 'success' | 'danger' | 'warning' | 'brand' | 'outline' | 'need' | 'want';
  children: ReactNode;
  dot?: boolean;
}) {
  return (
    <span className={`badge ${tone ?? ''}`}>
      {dot && <span className="dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function ProgressBar({
  label,
  data,
  color,
}: {
  label: string;
  data: ProgressBarData;
  color: string;
}) {
  const { fmt } = useApp();
  const width = Math.min(data.percent, 100);
  const over = data.over_cents > 0;
  return (
    <div className="progress">
      <div className="spread small">
        <span className="row strong">
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: color,
              display: 'inline-block',
            }}
          />
          {label}
        </span>
        <span className="num muted">
          <span className="text-2 strong">{fmt(data.actual_cents)}</span> / {fmt(data.plan_cents)}
        </span>
      </div>
      <div
        className="track"
        role="progressbar"
        aria-label={`${label}: ${data.percent}% of plan`}
        aria-valuenow={data.percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`fill ${over ? 'over' : ''}`}
          style={{ width: `${width}%`, background: color }}
        />
      </div>
      <span className={`tiny ${over ? 'neg' : 'muted'}`}>
        {over
          ? `${fmt(data.over_cents)} over your ${label.toLowerCase()} plan`
          : `${data.percent}% of plan used`}
      </span>
    </div>
  );
}

export function Skeleton({
  height = 16,
  width = '100%',
}: {
  height?: number;
  width?: number | string;
}) {
  return <div className="skeleton" style={{ height, width }} aria-hidden="true" />;
}

export function LoadingPanels({ count = 3 }: { count?: number }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div className="panel panel-body stack-sm" key={i}>
          <Skeleton height={14} width="30%" />
          <Skeleton height={24} width="55%" />
          <Skeleton height={12} />
          <Skeleton height={12} width="75%" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: LucideIcon;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="tile" aria-hidden="true">
        <Icon size={22} />
      </span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="callout danger" role="alert">
      <CircleAlert size={18} />
      <div className="grow">
        <p>{message}</p>
        {onRetry && (
          <button className="btn sm" style={{ marginTop: 10 }} onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

export function PanelHead({
  title,
  icon: Icon,
  subtitle,
  action,
}: {
  title: string;
  icon?: LucideIcon;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="panel-head">
      <div className="grow">
        <h2>
          {Icon && <Icon size={18} aria-hidden="true" />}
          {title}
        </h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Accessible dialog: bottom sheet on phones, centred modal on larger screens. */
export function Sheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>(
      '[autofocus], .sheet-body input, .sheet-body select, .sheet-body textarea, .sheet-body button',
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
        aria-labelledby={titleId}
        ref={ref}
        tabIndex={-1}
      >
        <div className="sheet-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-btn sm" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
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
      <label htmlFor={id}>{label}</label>
      <div className={`money-input ${big ? 'big' : ''}`}>
        <span className="prefix">{currencySymbol(currency).trim()}</span>
        <input
          id={id}
          className="input"
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
      </div>
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

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  danger?: boolean;
  divider?: boolean;
}

/** "More" dropdown menu (kebab). Closes on outside click or Escape. */
export function Menu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    wrap.current?.querySelector<HTMLElement>('.menu button')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="menu-wrap" ref={wrap}>
      <button
        type="button"
        className="icon-btn sm"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="menu" role="menu">
          {items.map((it, i) => (
            <div key={i}>
              {it.divider && <hr />}
              <button
                type="button"
                role="menuitem"
                className={it.danger ? 'danger' : ''}
                onClick={() => {
                  setOpen(false);
                  it.onClick();
                }}
              >
                {it.icon && <it.icon size={16} />}
                {it.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** ‹ label › stepper for cycles. */
export function PeriodSwitcher({
  label,
  sub,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
}: {
  label: string;
  sub?: string;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
}) {
  return (
    <div className="period">
      <button
        className="icon-btn sm"
        onClick={onPrev}
        disabled={prevDisabled}
        aria-label="Previous period"
      >
        <ChevronLeft size={18} />
      </button>
      <div className="label">
        {label}
        {sub && <small>{sub}</small>}
      </div>
      <button
        className="icon-btn sm"
        onClick={onNext}
        disabled={nextDisabled}
        aria-label="Next period"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  description?: string;
}) {
  const id = useId();
  return (
    <div className="switch-row">
      <label htmlFor={id} className="grow">
        <span className="strong small" style={{ display: 'block' }}>
          {label}
        </span>
        {description && <span className="hint">{description}</span>}
      </label>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="toggle"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </div>
  );
}
