import { useCallback } from 'react';
import { suggestType } from '../../shared/finance';
import type { WishlistItem } from '../../shared/types';
import { api, errorMessage } from './api';
import { useApp } from './context';

/** Add a wishlist item by name only (like a to-do list). Need/want is guessed quietly. */
export function useQuickAdd() {
  const { toast, changed } = useApp();
  return useCallback(
    async (name: string, estimatedCents: number | null = null): Promise<WishlistItem | null> => {
      const clean = name.trim().slice(0, 120);
      if (!clean) return null;
      try {
        const res = await api<{ item: WishlistItem }>('/api/wishlist', {
          method: 'POST',
          body: { name: clean, type: suggestType(clean).type, estimated_cents: estimatedCents },
        });
        toast({
          message: `Added “${clean}”.`,
          actionLabel: 'Undo',
          onAction: () => {
            api(`/api/wishlist/${res.item.id}`, { method: 'DELETE' })
              .then(changed)
              .catch((e) => toast({ message: errorMessage(e), tone: 'error' }));
          },
        });
        changed();
        return res.item;
      } catch (e) {
        toast({ message: errorMessage(e), tone: 'error' });
        return null;
      }
    },
    [toast, changed],
  );
}
