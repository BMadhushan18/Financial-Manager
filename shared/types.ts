// Shared domain types used by the React app, the API and the tests.
// All money values are INTEGER cents. Dates are ISO strings "YYYY-MM-DD".

export type EntryType = 'NEED' | 'WANT';
export type Priority = 'HIGH' | 'MEDIUM' | 'LOW';
export type Urgency = 'NOW' | 'THIS_MONTH' | 'SOMEDAY';
export type WishStatus = 'IDEA' | 'PLANNED' | 'BOUGHT' | 'DROPPED';
export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'other';
export type CycleMode = 'salary' | 'calendar';
export type IncomeSource = 'salary' | 'bonus' | 'side_job' | 'gift' | 'refund' | 'other';
export type IncomeStatus = 'expected' | 'received';
export type CheckChoice = 'buy' | 'remind' | 'next_month' | 'cancel';
export type RolloverDecision = 'next' | 'idea' | 'drop';
export type SavingsMode = 'amount' | 'percent';

export const ENTRY_TYPES: EntryType[] = ['NEED', 'WANT'];
export const PRIORITIES: Priority[] = ['HIGH', 'MEDIUM', 'LOW'];
export const URGENCIES: Urgency[] = ['NOW', 'THIS_MONTH', 'SOMEDAY'];
export const WISH_STATUSES: WishStatus[] = ['IDEA', 'PLANNED', 'BOUGHT', 'DROPPED'];
export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'bank_transfer', 'other'];
export const INCOME_SOURCES: IncomeSource[] = [
  'salary',
  'bonus',
  'side_job',
  'gift',
  'refund',
  'other',
];
export const CHECK_CHOICES: CheckChoice[] = ['buy', 'remind', 'next_month', 'cancel'];

export interface CycleRange {
  start: string;
  end: string;
}

export interface Settings {
  salary_day: number;
  cycle_mode: CycleMode;
  currency: string;
  salary_cents: number;
  split_needs: number;
  split_wants: number;
  split_savings: number;
  warnings_enabled: boolean;
  big_want_percent: number;
  cooling_days: number;
  emergency_months: number;
  emergency_target_cents: number | null;
  onboarded: boolean;
}

export interface Category {
  id: number;
  name: string;
  type: EntryType;
  priority: Priority;
  icon: string;
  color: string;
  monthly_limit_cents: number | null;
  is_default: boolean;
  is_archived: boolean;
}

export interface IncomeEntry {
  id: number;
  date: string;
  source: IncomeSource;
  amount_cents: number;
  status: IncomeStatus;
  note: string | null;
}

export interface FixedBill {
  id: number;
  name: string;
  amount_cents: number;
  due_day: number;
  category_id: number | null;
  is_active: boolean;
}

/** A bill as it stands in one cycle (paid or not). */
export interface BillInCycle extends FixedBill {
  type: EntryType;
  due_date: string;
  is_paid: boolean;
  paid_cents: number | null;
  paid_at: string | null;
  payment_id: number | null;
  expense_id: number | null;
}

export interface SavingsGoal {
  mode: SavingsMode;
  amount_cents: number;
  percent: number;
}

export interface SavingsMove {
  id: number;
  date: string;
  amount_cents: number;
  note: string | null;
}

export interface WishlistItem {
  id: number;
  name: string;
  category_id: number | null;
  type: EntryType;
  priority: Priority;
  urgency: Urgency;
  estimated_cents: number | null;
  quantity: number;
  link: string | null;
  note: string | null;
  status: WishStatus;
  prev_status: WishStatus | null;
  added_at: string;
  target_cycle: string | null;
  reminder_date: string | null;
  bought_at: string | null;
  actual_cents: number | null;
  payment_method: PaymentMethod | null;
  dropped_at: string | null;
  repeat_of: number | null;
  expense_id: number | null;
}

export interface PriceHistoryEntry {
  id: number;
  price_cents: number;
  changed_at: string;
}

export interface Expense {
  id: number;
  amount_cents: number;
  date: string;
  category_id: number | null;
  type: EntryType;
  payment_method: PaymentMethod;
  note: string | null;
  wishlist_item_id: number | null;
  fixed_bill_id: number | null;
  refund_of: number | null;
  created_at: string;
  refunded_cents?: number;
}

/** Fields needed to insert an expense row. */
export type NewExpense = Omit<Expense, 'id' | 'created_at' | 'refunded_cents'>;

export type WarningCode = 'UNPAID_BILLS' | 'WANTS_OVER' | 'SAVINGS_RISK' | 'SHORT' | 'COOLING_OFF';

export interface PurchaseWarning {
  code: WarningCode;
  amount_cents: number;
  message: string;
}

export interface ProgressBarData {
  plan_cents: number;
  actual_cents: number;
  percent: number;
  over_cents: number;
}

export interface BudgetProgress {
  needs: ProgressBarData;
  wants: ProgressBarData;
  savings: ProgressBarData;
}

export interface CycleTotals {
  income_cents: number;
  income_received_cents: number;
  income_expected_cents: number;
  bills_committed_cents: number;
  bills_paid_cents: number;
  bills_unpaid_cents: number;
  unpaid_need_bills_cents: number;
  savings_goal_cents: number;
  savings_moved_cents: number;
  reserved_cents: number;
  other_expenses_cents: number;
  needs_spent_cents: number;
  wants_spent_cents: number;
}

export interface ScoredWish {
  item: WishlistItem;
  score: number;
  label: string;
}

export interface CurrentCycleResponse {
  today: string;
  cycle: CycleRange;
  next_cycle: CycleRange;
  days_left: number;
  totals: CycleTotals;
  safe_to_spend_cents: number;
  safe_per_day_cents: number;
  progress: BudgetProgress;
  incomes: IncomeEntry[];
  bills: BillInCycle[];
  upcoming_bills: BillInCycle[];
  planned: WishlistItem[];
  reminders: WishlistItem[];
  top_wishes: ScoredWish[];
  savings: {
    goal: SavingsGoal;
    moves: SavingsMove[];
    balance_cents: number;
    emergency_target_cents: number;
  };
  rollover: { previous_cycle: CycleRange; items: WishlistItem[] } | null;
  previous_closed: boolean;
}

export interface CycleSummary {
  start: string;
  end: string;
  income_cents: number;
  spent_cents: number;
  needs_cents: number;
  wants_cents: number;
  saved_cents: number;
}

export interface ReportsResponse {
  from: string;
  to: string;
  summary: CycleSummary;
  cycles: CycleSummary[];
  by_category: { category_id: number | null; name: string; color: string; total_cents: number }[];
  money_saved: {
    dropped_cents: number;
    dropped_count: number;
    paused_cents: number;
    paused_count: number;
  };
  savings_rate_percent: number;
  emergency: { balance_cents: number; target_cents: number };
}

export interface BootstrapResponse {
  email: string;
  settings: Settings;
  categories: Category[];
  bills: FixedBill[];
  savings_goal: SavingsGoal;
}
