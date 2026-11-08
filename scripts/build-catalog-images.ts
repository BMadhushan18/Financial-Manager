// Resolves a real photo for every catalogue item from Wikipedia (lead image
// of the article in `wiki`) and writes shared/catalog-images.json.
// Images are hosted by Wikimedia Commons under free licences; each entry keeps
// the article link for attribution (shown in Settings → Image credits).
//
//   npx tsx scripts/build-catalog-images.ts
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOG } from '../shared/catalog';

const UA = 'MoneyMind-catalog-builder/1.0 (https://github.com/BMadhushan18/Financial-Manager)';
const out: Record<string, { src: string; page: string }> = {};
const missing: string[] = [];

for (const item of CATALOG) {
  if (!item.wiki) continue; // no good free photo – the app shows the category icon
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(item.wiki.replace(/ /g, '_'))}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) throw new Error(String(res.status));
    const j = (await res.json()) as {
      thumbnail?: { source: string };
      content_urls?: { desktop?: { page?: string } };
    };
    if (!j.thumbnail?.source) throw new Error('no image');
    // Drop tracking query parameters; keep the plain thumbnail URL.
    const src = j.thumbnail.source.split('?')[0]!;
    out[item.id] = {
      src,
      page: j.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${item.wiki}`,
    };
  } catch (e) {
    missing.push(`${item.id} (${item.wiki}): ${(e as Error).message}`);
  }
  await new Promise((r) => setTimeout(r, 120)); // be polite to the API
}

const file = resolve(dirname(fileURLToPath(import.meta.url)), '../shared/catalog-images.json');
writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
console.log(
  `Resolved ${Object.keys(out).length}/${CATALOG.length} images → shared/catalog-images.json`,
);
if (missing.length) console.log('Missing:\n  ' + missing.join('\n  '));
