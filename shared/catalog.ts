// Searchable catalogue of everyday purchases (data in ./catalog-data.ts).
// Each item has a default category and NEED/WANT label so the app never asks.
// Photos: Wikipedia lead images with free licences (Wikimedia Commons),
// resolved by scripts/build-catalog-images.ts into ./catalog-images.json.
import { CATALOG_SECTIONS } from './catalog-data';
import photos from './catalog-photos.json';
import type { EntryType } from './types';

export interface CatalogItem {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  type: EntryType;
  /** Wikipedia article used for the photo, or '' for none. */
  wiki: string;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parse(): CatalogItem[] {
  const out: CatalogItem[] = [];
  const used = new Set<string>();
  for (const section of CATALOG_SECTIONS) {
    for (const raw of section.items.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const flip = line.startsWith('~');
      const [nameRaw = '', wikiRaw = '', aliasRaw = ''] = (flip ? line.slice(1) : line)
        .split('|')
        .map((p) => p.trim());
      if (!nameRaw) continue;
      let id = slug(nameRaw);
      while (used.has(id)) id += '-2';
      used.add(id);
      out.push({
        id,
        name: nameRaw,
        category: section.category,
        type: flip ? (section.type === 'NEED' ? 'WANT' : 'NEED') : section.type,
        wiki: wikiRaw === '-' ? '' : wikiRaw || nameRaw,
        aliases: aliasRaw
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
      });
    }
  }
  return out;
}

export const CATALOG: CatalogItem[] = parse();

const PHOTOS = photos as Record<string, string>;

/** File name of the self-hosted copy in public/items/ for a Commons file path. */
export function localImageFile(id: string, commonsPath: string): string {
  const last = commonsPath.split('/').pop() ?? '';
  let ext = (last.split('.').pop() ?? 'jpg').toLowerCase();
  if (ext === 'jpeg') ext = 'jpg';
  if (!['jpg', 'png', 'webp', 'gif'].includes(ext)) ext = 'jpg';
  return `${id}.${ext}`;
}

/** Photo URL (served by MoneyMind itself from /items/), or null when the item has none. */
export function catalogImage(item: CatalogItem | undefined | null): string | null {
  if (!item) return null;
  const ext = PHOTOS[item.id];
  return ext ? `/items/${item.id}.${ext}` : null;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface Indexed {
  item: CatalogItem;
  name: string;
  words: string[];
  aliases: string[];
}

const INDEX: Indexed[] = CATALOG.map((item) => {
  const name = norm(item.name);
  return { item, name, words: name.split(' '), aliases: item.aliases.map(norm) };
});

/** Ranked search: exact > alias > name prefix > word prefix > partial. */
export function searchCatalog(query: string, limit = 8): CatalogItem[] {
  const q = norm(query);
  if (!q) return [];
  const scored: { item: CatalogItem; score: number }[] = [];
  for (const x of INDEX) {
    let score = 0;
    if (x.name === q) score = 100;
    else if (x.aliases.includes(q)) score = 85;
    else if (x.name.startsWith(q)) score = 80;
    else if (x.words.some((w) => w.startsWith(q))) score = 70;
    else if (x.aliases.some((a) => a.startsWith(q) || a.split(' ').some((w) => w.startsWith(q))))
      score = 55;
    else if (x.name.includes(q)) score = 40;
    else if (x.aliases.some((a) => a.includes(q))) score = 30;
    if (score > 0) {
      // Prefer shorter, more general names on ties ("Rice" before "Rice flour").
      scored.push({ item: x.item, score: score - x.name.length / 100 });
    }
  }
  return scored
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .slice(0, limit)
    .map((s) => s.item);
}

/** The catalogue item a saved free-text name refers to (for its photo). */
export function matchCatalog(name: string | null | undefined): CatalogItem | undefined {
  if (!name) return undefined;
  const n = norm(name);
  if (!n) return undefined;
  const exact = INDEX.find((x) => x.name === n);
  if (exact) return exact.item;
  const alias = INDEX.find((x) => x.aliases.includes(n));
  if (alias) return alias.item;
  // Whole-word hits inside longer names, e.g. "Petrol for bike" → Bike fuel.
  const words = new Set(n.split(' '));
  return (
    INDEX.find((x) => words.has(x.name)) ??
    INDEX.find((x) => x.aliases.some((a) => !a.includes(' ') && a.length > 2 && words.has(a)))
  )?.item;
}
