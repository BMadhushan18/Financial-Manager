import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { currencySymbol, formatMoney, localTodayISO } from '../shared/finance';
import type {
  BootstrapResponse,
  CheckChoice,
  CurrentCycleResponse,
  PurchaseWarning,
} from '../shared/types';
import { ConfirmSheet, PurchaseWarningSheet, Toasts, type ToastItem } from './components/Dialogs';
import { SheetHost } from './components/forms/SheetHost';
import { api, ApiError, AUTH_EVENT, errorMessage } from './lib/api';
import {
  AppContext,
  type AppValue,
  type AuthState,
  type ConfirmOptions,
  type PendingPurchase,
  type PurchaseRequest,
  type SheetState,
  type ToastInput,
} from './lib/context';
import { readLocal, writeLocal } from './lib/hooks';

interface ToastHandlers {
  timer: ReturnType<typeof setTimeout>;
  onAction?: () => void;
  onExpire?: () => void;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [today, setToday] = useState(localTodayISO);
  const [boot, setBoot] = useState<BootstrapResponse | null>(null);
  const [cycle, setCycle] = useState<CurrentCycleResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [privacy, setPrivacy] = useState(() => readLocal('mm-privacy', '0') === '1');
  const [sheet, setSheet] = useState<SheetState>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<{
    options: ConfirmOptions;
    resolve: (b: boolean) => void;
  } | null>(null);
  const [pending, setPending] = useState<PendingPurchase | null>(null);
  const handlers = useRef(new Map<number, ToastHandlers>());
  const toastId = useRef(0);

  const [auth, setAuth] = useState<AuthState>('loading');

  const refresh = useCallback(async () => {
    try {
      const [b, c] = await Promise.all([
        api<BootstrapResponse>('/api/bootstrap'),
        api<CurrentCycleResponse>('/api/cycle/current'),
      ]);
      setBoot(b);
      setCycle(c);
      setLoadError(null);
      setAuth('ok');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setAuth('signed-out');
        setBoot(null);
        setCycle(null);
        setLoadError(null);
      } else if (e instanceof ApiError && e.code === 'PASSWORD_CHANGE_REQUIRED') {
        setAuth('must-change');
        setLoadError(null);
      } else {
        setLoadError(errorMessage(e));
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Any request that finds the session expired (or a password change required) re-checks sign-in.
  // Only reacts while signed in, so refresh()'s own 401 cannot loop.
  useEffect(() => {
    if (auth !== 'ok') return;
    const onAuth = () => void refresh();
    window.addEventListener(AUTH_EVENT, onAuth);
    return () => window.removeEventListener(AUTH_EVENT, onAuth);
  }, [refresh, auth]);

  const signOut = useCallback(async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      // even if the request fails, show the sign-in screen
    }
    setBoot(null);
    setCycle(null);
    setAuth('signed-out');
  }, []);

  // A new day may start a new cycle: refresh when the app comes back into view.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const now = localTodayISO();
      if (now !== today) {
        setToday(now);
        void refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [today, refresh]);

  const changed = useCallback(() => {
    setVersion((v) => v + 1);
    void refresh();
  }, [refresh]);

  const currency = boot?.settings.currency ?? 'LKR';
  const fmt = useCallback(
    (cents: number) => (privacy ? `${currencySymbol(currency)}****` : formatMoney(cents, currency)),
    [privacy, currency],
  );

  const togglePrivacy = useCallback(() => {
    setPrivacy((p) => {
      writeLocal('mm-privacy', p ? '0' : '1');
      return !p;
    });
  }, []);

  /* ---------- toasts with 5-second undo ---------- */
  const removeToast = useCallback((id: number) => {
    const h = handlers.current.get(id);
    if (h) clearTimeout(h.timer);
    handlers.current.delete(id);
    setToasts((list) => list.filter((t) => t.id !== id));
    return h;
  }, []);

  const toast = useCallback(
    (t: ToastInput) => {
      const id = ++toastId.current;
      const duration = t.duration ?? (t.actionLabel ? 5000 : 3500);
      const timer = setTimeout(() => {
        const h = removeToast(id);
        h?.onExpire?.();
      }, duration);
      handlers.current.set(id, { timer, onAction: t.onAction, onExpire: t.onExpire });
      setToasts((list) => [
        ...list.slice(-2),
        { id, message: t.message, actionLabel: t.actionLabel, tone: t.tone },
      ]);
    },
    [removeToast],
  );

  // If the page is closed during an undo window, commit the pending action.
  useEffect(() => {
    const flush = () => {
      for (const [id, h] of handlers.current) {
        clearTimeout(h.timer);
        handlers.current.delete(id);
        h.onExpire?.();
      }
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setConfirmState({ options, resolve })),
    [],
  );

  /* ---------- smart purchase check ---------- */
  const checkPurchase = useCallback(async (request: PurchaseRequest): Promise<CheckChoice> => {
    const res = await api<{ warnings: PurchaseWarning[]; cooling_days?: number }>(
      '/api/purchase-check',
      {
        method: 'POST',
        body: request,
      },
    );
    if (res.warnings.length === 0) return 'buy';
    const choice = await new Promise<CheckChoice>((resolve) =>
      setPending({ warnings: res.warnings, coolingDays: res.cooling_days ?? 7, request, resolve }),
    );
    setPending(null);
    api('/api/purchase-checks', {
      method: 'POST',
      body: {
        wishlist_item_id: request.wishlist_item_id,
        amount_cents: request.amount_cents,
        type: request.type,
        warnings: res.warnings.map((w) => w.code),
        choice,
      },
    }).catch(() => undefined);
    return choice;
  }, []);

  /* ---------- delete with 5-second undo ---------- */
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const unhide = useCallback((key: string) => {
    setHidden((s) => {
      const n = new Set(s);
      n.delete(key);
      return n;
    });
  }, []);
  const deferDelete = useCallback(
    (key: string, message: string, commit: () => Promise<unknown>) => {
      setHidden((s) => new Set(s).add(key));
      toast({
        message,
        actionLabel: 'Undo',
        onAction: () => unhide(key),
        onExpire: () => {
          commit()
            .then(() => {
              setVersion((v) => v + 1);
              return refresh();
            })
            .catch((e) => toast({ message: errorMessage(e), tone: 'error' }))
            .finally(() => unhide(key));
        },
      });
    },
    [toast, unhide, refresh],
  );
  const isHidden = useCallback((key: string) => hidden.has(key), [hidden]);

  const value = useMemo<AppValue>(() => {
    const categories = boot?.categories ?? [];
    return {
      today,
      boot,
      cycle,
      loadError,
      version,
      refresh,
      changed,
      currency,
      fmt,
      privacy,
      togglePrivacy,
      categories,
      activeCategories: categories.filter((c) => !c.is_archived),
      categoryById: (id) => (id == null ? undefined : categories.find((c) => c.id === id)),
      sheet,
      openSheet: setSheet,
      closeSheet: () => setSheet(null),
      toast,
      confirm,
      checkPurchase,
      deferDelete,
      isHidden,
      auth,
      signOut,
    };
  }, [
    today,
    boot,
    cycle,
    loadError,
    version,
    refresh,
    changed,
    currency,
    fmt,
    privacy,
    togglePrivacy,
    sheet,
    toast,
    confirm,
    checkPurchase,
    deferDelete,
    isHidden,
    auth,
    signOut,
  ]);

  return (
    <AppContext.Provider value={value}>
      {children}
      <SheetHost />
      {pending && <PurchaseWarningSheet pending={pending} fmt={fmt} />}
      {confirmState && (
        <ConfirmSheet
          options={confirmState.options}
          onDone={(ok) => {
            confirmState.resolve(ok);
            setConfirmState(null);
          }}
        />
      )}
      <Toasts
        items={toasts}
        onAction={(id) => removeToast(id)?.onAction?.()}
        onDismiss={(id) => {
          removeToast(id)?.onExpire?.();
        }}
      />
    </AppContext.Provider>
  );
}
