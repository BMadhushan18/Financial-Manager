import type {
  IncomeSource,
  PaymentMethod,
  Priority,
  Urgency,
  WishStatus,
} from '../../shared/types';
import { daysBetween } from '../../shared/finance';

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  other: 'Other',
};

export const URGENCY_LABEL: Record<Urgency, string> = {
  NOW: 'Now',
  THIS_MONTH: 'This month',
  SOMEDAY: 'Someday',
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

export const STATUS_LABEL: Record<WishStatus, string> = {
  IDEA: 'Idea',
  PLANNED: 'Planned',
  BOUGHT: 'Bought',
  DROPPED: 'Dropped',
};

export const SOURCE_LABEL: Record<IncomeSource, string> = {
  salary: 'Salary',
  bonus: 'Bonus',
  side_job: 'Side job',
  gift: 'Gift',
  refund: 'Refund',
  other: 'Other',
};

function toDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

/** "Mon, 8 Nov" */
export function formatDay(iso: string): string {
  return toDate(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** "8 Nov 2026" */
export function formatDate(iso: string): string {
  return toDate(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** "8 Nov" */
export function formatShort(iso: string): string {
  return toDate(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function relativeDay(iso: string, today: string): string {
  const diff = daysBetween(today, iso);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < 0) return `${-diff} days ago`;
  return `In ${diff} days`;
}

export function daysOnList(addedAt: string, today: string): string {
  const d = daysBetween(addedAt, today);
  if (d <= 0) return 'Added today';
  if (d === 1) return '1 day on list';
  return `${d} days on list`;
}
