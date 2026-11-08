import { useCallback } from 'react';
import { addDays, formatMoney, itemTotalCents } from '../../shared/finance';
import type { CheckChoice, WishlistItem } from '../../shared/types';
import { api, ApiError, errorMessage } from './api';
import { useApp } from './context';
import { formatShort } from './labels';

/** Wishlist actions shared by Home, Wishlist and the forms. */
export function useWishActions() {
  const app = useApp();
  const { toast, changed, confirm, today } = app;
  const coolingDays = app.boot?.settings.cooling_days ?? 7;
  const currency = app.currency;

  const fail = useCallback(
    (e: unknown) => toast({ message: errorMessage(e), tone: 'error' }),
    [toast],
  );

  const undo = useCallback(
    async (item: WishlistItem, quiet = false) => {
      try {
        await api(`/api/wishlist/${item.id}/undo`, { method: 'POST' });
        if (!quiet) toast({ message: `${item.name} is back on your list.` });
        changed();
      } catch (e) {
        fail(e);
      }
    },
    [toast, changed, fail],
  );

  const plan = useCallback(
    async (item: WishlistItem, cycle: 'current' | 'next' = 'current') => {
      try {
        await api(`/api/wishlist/${item.id}/plan`, { method: 'POST', body: { cycle } });
        toast({
          message:
            cycle === 'next'
              ? `${item.name} is planned for next month.`
              : `${item.name} is planned for this month. Its price is set aside.`,
        });
        changed();
      } catch (e) {
        if (e instanceof ApiError && e.code === 'DOES_NOT_FIT') {
          const missing = Number(e.details?.missing_cents ?? 0);
          const ok = await confirm({
            title: 'Not quite enough this month',
            message: `You need ${formatMoney(missing, currency)} more in safe-to-spend for ${item.name}. You can plan it anyway, or plan it for next month.`,
            confirmLabel: 'Plan anyway',
          });
          if (ok) {
            try {
              await api(`/api/wishlist/${item.id}/plan`, {
                method: 'POST',
                body: { cycle: 'current', force: true },
              });
              toast({ message: `${item.name} is planned. Safe-to-spend is now below zero.` });
              changed();
            } catch (e2) {
              fail(e2);
            }
          }
          return;
        }
        fail(e);
      }
    },
    [toast, changed, confirm, currency, fail],
  );

  const unplan = useCallback(
    async (item: WishlistItem) => {
      try {
        await api(`/api/wishlist/${item.id}/unplan`, { method: 'POST' });
        toast({ message: `${item.name} moved back to ideas.` });
        changed();
      } catch (e) {
        fail(e);
      }
    },
    [toast, changed, fail],
  );

  const drop = useCallback(
    async (item: WishlistItem) => {
      try {
        await api(`/api/wishlist/${item.id}/drop`, { method: 'POST' });
        const saved = itemTotalCents(item);
        toast({
          message:
            saved > 0
              ? `Dropped. ${formatMoney(saved, currency)} stays in your pocket.`
              : 'Dropped.',
          actionLabel: 'Undo',
          onAction: () => void undo(item, true),
        });
        changed();
      } catch (e) {
        fail(e);
      }
    },
    [toast, changed, currency, undo, fail],
  );

  const readd = useCallback(
    async (item: WishlistItem) => {
      try {
        await api(`/api/wishlist/${item.id}/readd`, { method: 'POST' });
        toast({ message: `${item.name} is on your list again.` });
        changed();
      } catch (e) {
        fail(e);
      }
    },
    [toast, changed, fail],
  );

  /** Act on a purchase-check choice that was NOT "buy". */
  const handleDeferChoice = useCallback(
    async (item: WishlistItem, choice: CheckChoice) => {
      if (choice === 'remind') {
        const date = addDays(today, coolingDays);
        await api(`/api/wishlist/${item.id}`, { method: 'PUT', body: { reminder_date: date } });
        toast({ message: `Okay, we will remind you on ${formatShort(date)}.` });
        changed();
      } else if (choice === 'next_month') {
        await api(`/api/wishlist/${item.id}/plan`, { method: 'POST', body: { cycle: 'next' } });
        toast({ message: `${item.name} is planned for next month.` });
        changed();
      }
    },
    [today, coolingDays, toast, changed],
  );

  return { plan, unplan, drop, undo, readd, handleDeferChoice, fail };
}
