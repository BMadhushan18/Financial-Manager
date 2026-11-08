import { describe, expect, it } from 'vitest';
import { CATALOG, catalogImage, matchCatalog, searchCatalog } from './catalog';
import { catalogCredit } from './catalog-credits';
import { DEFAULT_CATEGORIES } from './defaults';

describe('item catalogue', () => {
  it('is large, has unique ids and only uses real default categories', () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(500);
    const ids = new Set(CATALOG.map((c) => c.id));
    expect(ids.size).toBe(CATALOG.length);
    const names = new Set(DEFAULT_CATEGORIES.map((c) => c.name));
    for (const item of CATALOG) expect(names.has(item.category), item.id).toBe(true);
  });

  it('has a self-hosted photo for most items', () => {
    const withPhoto = CATALOG.filter((c) => catalogImage(c));
    expect(withPhoto.length).toBeGreaterThanOrEqual(CATALOG.length * 0.9);
    for (const c of withPhoto) {
      expect(catalogImage(c)).toMatch(/^\/items\/[a-z0-9-]+\.(jpg|png|webp|gif)$/);
    }
  });

  it('credits every photo to its Wikimedia Commons page', () => {
    for (const c of CATALOG.filter((x) => catalogImage(x))) {
      expect(catalogCredit(c.id)).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    }
  });
});

describe('searchCatalog', () => {
  it('finds items by name, prefix and local words', () => {
    expect(searchCatalog('rice')[0]?.id).toBe('rice');
    expect(searchCatalog('petrol')[0]?.id).toBe('bike-fuel');
    expect(searchCatalog('refuel')[0]?.id).toBe('bike-fuel');
    expect(searchCatalog('headph')[0]?.id).toBe('headphones');
    expect(searchCatalog('parippu')[0]?.id).toBe('dhal');
    expect(searchCatalog('three wheeler')[0]?.id).toBe('tuk-tuk-ride');
    expect(searchCatalog('pol')[0]?.id).toBe('coconuts');
    expect(searchCatalog('fridge')[0]?.id).toBe('refrigerator');
  });

  it('prefers the general item over longer names', () => {
    expect(
      searchCatalog('rice')
        .map((c) => c.id)
        .slice(0, 2),
    ).toContain('rice');
  });

  it('is case and punctuation insensitive', () => {
    expect(searchCatalog('  T-SHIRT ')[0]?.id).toBe('t-shirt');
  });

  it('returns nothing for an empty query and respects the limit', () => {
    expect(searchCatalog('')).toEqual([]);
    expect(searchCatalog('s', 3)).toHaveLength(3);
  });
});

describe('matchCatalog (photo for a saved name)', () => {
  it('matches exact names and aliases', () => {
    expect(matchCatalog('Bike fuel')?.id).toBe('bike-fuel');
    expect(matchCatalog('petrol')?.id).toBe('bike-fuel');
    expect(matchCatalog('Keells groceries')?.id).toBe('weekly-groceries');
  });

  it('matches whole words inside longer names', () => {
    expect(matchCatalog('Petrol for bike')?.id).toBe('bike-fuel');
    expect(matchCatalog('New running shoes')?.id).toBe('shoes');
  });

  it('does not invent matches', () => {
    expect(matchCatalog('Price tag gun')).toBeUndefined();
    expect(matchCatalog('')).toBeUndefined();
    expect(matchCatalog(null)).toBeUndefined();
  });
});
