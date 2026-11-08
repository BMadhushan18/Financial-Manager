import { useState } from 'react';
import { catalogImage, matchCatalog, type CatalogItem } from '../../shared/catalog';
import type { Category } from '../../shared/types';
import { CategoryIcon } from './CategoryIcon';

/** Real photo for a known item (by name), otherwise the category icon. */
export function ItemThumb({
  name,
  item,
  category,
  size = 40,
}: {
  name?: string | null;
  item?: CatalogItem;
  category?: Category;
  size?: number;
}) {
  const match = item ?? matchCatalog(name);
  const src = catalogImage(match);
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span style={{ display: 'inline-flex', flex: 'none' }}>
        <CategoryIcon
          icon={category?.icon}
          name={category?.name ?? match?.category ?? name}
          color={category?.color}
          size={size < 38 ? 'sm' : 'md'}
        />
      </span>
    );
  }
  return (
    <img
      className="thumb"
      src={src}
      alt=""
      width={size}
      height={size}
      decoding="async"
      referrerPolicy="no-referrer"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}
