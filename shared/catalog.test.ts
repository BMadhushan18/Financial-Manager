import { describe, expect, it } from 'vitest';
import { CATALOG, catalogImage, matchCatalog, searchCatalog } from './catalog';
import { DEFAULT_CATEGORIES } from './defaults';

describe('item catalogue', () => {
  it('has unique ids and only uses real default categories', () => {
    const ids = new Set(CATALOG.map((c) => c.id));
    expect(ids.size).toBe(CATALOG.length);
    const names = new Set(DEFAULT_CATEGORIES.map((c) => c.name));
    for (const item of CATALOG) expect(names.has(item.category), item.id).toBe(true);
  });

  it('has a real photo for almost every item', () => {
    const withPhoto = CATALOG.filter((c) => catalogImage(c));
    expect(withPhoto.length).toBeGreaterThanOrEqual(CATALOG.length - 3);
    for (const c of withPhoto)
      expect(catalogImage(c)).toMatch(/^https:\/\/(upload|thumb)\.wikimedia\.org\//);
  });
});

describe('searchCatalog', () => {
  it('finds items by name, prefix and local words', () => {
    expect(searchCatalog('rice')[0]?.id).toBe('rice');
    expect(searchCatalog('petrol')[0]?.id).toBe('fuel');
    expect(searchCatalog('refuel')[0]?.id).toBe('fuel');
    expect(searchCatalog('head')[0]?.id).toBe('headphones');
    expect(searchCatalog('parippu')[0]?.id).toBe('dhal');
    expect(searchCatalog('three wheeler')[0]?.id).toBe('tuk');
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
    expect(matchCatalog('Bike fuel')?.id).toBe('fuel');
    expect(matchCatalog('petrol')?.id).toBe('fuel');
    expect(matchCatalog('Keells groceries')?.id).toBe('groceries');
  });

  it('matches whole words inside longer names', () => {
    expect(matchCatalog('Petrol for bike')?.id).toBe('fuel');
    expect(matchCatalog('New running shoes')?.id).toBe('shoes');
  });

  it('does not invent matches', () => {
    expect(matchCatalog('Price tag gun')).toBeUndefined();
    expect(matchCatalog('')).toBeUndefined();
    expect(matchCatalog(null)).toBeUndefined();
  });
});
