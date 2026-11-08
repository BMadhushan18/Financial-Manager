// Resolves a real photo for every catalogue item from Wikipedia and writes
// shared/catalog-images.json as { itemId: "<path under upload.wikimedia.org/wikipedia/commons/>" }.
//
// - Uses the MediaWiki "pageimages" API in batches of 50 titles.
// - pilicense=free: only freely licensed images (no fair-use pictures).
// - Only Wikimedia Commons files are kept (they carry free licences).
//
//   npx tsx scripts/build-catalog-images.ts
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOG, localImageFile } from '../shared/catalog';

const UA = 'MoneyMind-catalog-builder/1.0 (https://github.com/BMadhushan18/Financial-Manager)';

interface ApiPage {
  title: string;
  thumbnail?: { source: string };
}
interface ApiResponse {
  query?: {
    pages?: ApiPage[];
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
  };
}

const titles = [...new Set(CATALOG.map((c) => c.wiki).filter(Boolean))];
const imageByTitle = new Map<string, string>();

for (let i = 0; i < titles.length; i += 50) {
  const batch = titles.slice(i, i + 50);
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1' +
    '&prop=pageimages&piprop=thumbnail&pithumbsize=330&pilicense=free&pilimit=50&titles=' +
    encodeURIComponent(batch.join('|'));
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Wikipedia API ${res.status}`);
  const j = (await res.json()) as ApiResponse;
  // Follow normalisation + redirects from each requested title to its final page.
  const follow = new Map<string, string>();
  for (const n of j.query?.normalized ?? []) follow.set(n.from, n.to);
  for (const r of j.query?.redirects ?? []) follow.set(r.from, r.to);
  const pages = new Map((j.query?.pages ?? []).map((p) => [p.title, p]));
  for (const t of batch) {
    let final = t;
    for (let k = 0; k < 3 && follow.has(final); k++) final = follow.get(final)!;
    const src = pages.get(final)?.thumbnail?.source;
    // Commons files may come from upload.* or thumb.wikimedia.org; keep the path only.
    const m =
      src && /^https:\/\/(?:upload|thumb)\.wikimedia\.org\/wikipedia\/commons\/(.+)$/.exec(src);
    if (m) imageByTitle.set(t, m[1]!.split('?')[0]!);
  }
  await new Promise((r) => setTimeout(r, 300)); // be polite to the API
}

const out: Record<string, string> = {};
const missing: string[] = [];
for (const item of CATALOG) {
  if (!item.wiki) continue;
  const path = imageByTitle.get(item.wiki);
  if (path) out[item.id] = path;
  else missing.push(`${item.name} (${item.wiki})`);
}

const file = resolve(dirname(fileURLToPath(import.meta.url)), '../shared/catalog-images.json');
writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
// Compact { id: extension } map used by the app (full paths only load for credits).
const photos = Object.fromEntries(
  Object.entries(out).map(([id, path]) => [id, localImageFile(id, path).split('.').pop()!]),
);
writeFileSync(
  file.replace('catalog-images.json', 'catalog-photos.json'),
  JSON.stringify(photos) + '\n',
);
console.log(`${CATALOG.length} items · ${Object.keys(out).length} with photos`);
if (missing.length) console.log(`No free photo (${missing.length}):\n  ` + missing.join('\n  '));
