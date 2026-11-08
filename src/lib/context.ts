import { createContext, useContext } from 'react';
import type {
  BootstrapResponse,
  Category,
  CheckChoice,
  CurrentCycleResponse,
  EntryType,
  Expense,
  IncomeEntry,
  PurchaseWarning,
  WishlistItem,
} from '../../shared/types';

export type SheetState =
  | { kind: 'add-menu' }
  | { kind: 'expense'; expense?: Expense }
  | { kind: 'wish'; item?: WishlistItem }
  | { kind: 'income'; income?: IncomeEntry }
  | { kind: 'bought'; item: WishlistItem }
  | null;

export interface ToastInput {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Runs when the toast times out without the action being pressed (used for 5-second undo). */
  onExpire?: () => void;
  duration?: number;
  tone?: 'default' | 'error';
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  /** When set, the user must type this word to confirm. */
  typeToConfirm?: string;
}

export interface PurchaseRequest {
  amount_cents: number;
  type: EntryType;
  category_id?: number | null;
  wishlist_item_id?: number;
}

export interface PendingPurchase {
  warnings: PurchaseWarning[];
  coolingDays: number;
  request: PurchaseRequest;
  resolve: (c: CheckChoice) => void;
}

export interface AppValue {
  today: string;
  boot: BootstrapResponse | null;
  cycle: CurrentCycleResponse | null;
  loadError: string | null;
  /** Increases after every change so screens know to reload. */
  version: number;
  refresh: () => Promise<void>;
  /** Call after any successful change. */
  changed: () => void;
  currency: string;
  fmt: (cents: number) => string;
  privacy: boolean;
  togglePrivacy: () => void;
  categories: Category[];
  activeCategories: Category[];
  categoryById: (id: number | null | undefined) => Category | undefined;
  sheet: SheetState;
  openSheet: (s: SheetState) => void;
  closeSheet: () => void;
  toast: (t: ToastInput) => void;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  /** Runs the smart purchase check; resolves 'buy' straight away when nothing applies. */
  checkPurchase: (r: PurchaseRequest) => Promise<CheckChoice>;
  /**
   * Delete with a 5-second undo. The row (key like "expense:12") is hidden at once and
   * the request is only sent when the undo window ends.
   */
  deferDelete: (key: string, message: string, commit: () => Promise<unknown>) => void;
  isHidden: (key: string) => boolean;
}

export const AppContext = createContext<AppValue | null>(null);

export function useApp(): AppValue {
  const v = useContext(AppContext);
  if (!v) throw new Error('useApp must be used inside <AppProvider>');
  return v;
}
