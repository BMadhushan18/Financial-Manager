import { useCallback } from 'react';
import { matchCatalog, type CatalogItem } from '../../shared/catalog';
import { suggestType } from '../../shared/finance';
import type { Category, WishlistItem } from '../../shared/types';
import { api, errorMessage } from './api';
import { useApp } from './context';

/** Category + need/want for a name, decided automatically (never asked). */
export function autoClassify(
  name: string,
  categories: Category[],
  item?: CatalogItem,
): { category: Category | undefined; type: 'NEED' | 'WANT' } {
  const match = item ?? matchCatalog(name);
  const active = categories.filter((c) => !c.is_archived);
  const category =
    (match && active.find((c) => c.name.toLowerCase() === match.category.toLowerCase())) ??
    undefined;
  const type = match?.type ?? suggestType(name, category ?? null).type;
  return { category, type };
}

/** One-tap "add to wishlist" with automatic category and type. */
export function useQuickAdd() {
  const { activeCategories, toast, changed } = useApp();
  return useCallback(
    async (name: string, item?: CatalogItem): Promise<WishlistItem | null> => {
      const clean = (item?.name ?? name).trim().slice(0, 120);
      if (!clean) return null;
      const { category, type } = autoClassify(clean, activeCategories, item);
      try {
        const res = await api<{ item: WishlistItem }>('/api/wishlist', {
          method: 'POST',
          body: { name: clean, category_id: category?.id ?? null, type },
        });
        toast({
          message: `${clean} added to your list.`,
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
    [activeCategories, toast, changed],
  );
}
