// Downloads a small (120px) copy of every catalogue photo into public/items/
// so the app serves them itself: faster, works offline, no third-party
// requests from users' browsers. Safe to re-run: existing files are skipped.
// Photos are freely licensed (Wikimedia Commons); credits are shown in
// Settings → Item photo credits.
//
//   npx tsx scripts/download-catalog-images.ts
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import images from '../shared/catalog-images.json';
import { localImageFile } from '../shared/catalog';

const UA = 'MoneyMind-catalog-builder/1.0 (https://github.com/BMadhushan18/Financial-Manager)';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(root, 'public/items');
mkdirSync(dir, { recursive: true });

const entries = Object.entries(images as Record<string, string>);
const wanted = new Set(entries.map(([id, path]) => localImageFile(id, path)));

// Remove photos of items that no longer have one.
for (const f of readdirSync(dir)) if (!wanted.has(f)) unlinkSync(resolve(dir, f));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let done = 0;
let failed = 0;
for (const [id, path] of entries) {
  const file = resolve(dir, localImageFile(id, path));
  if (existsSync(file)) {
    done++;
    continue;
  }
  // Use the standard 120px thumbnail step.
  const url =
    'https://upload.wikimedia.org/wikipedia/commons/' + path.replace(/\/\d+px-/, '/120px-');
  let ok = false;
  for (let attempt = 0; attempt < 6 && !ok; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.status === 429 || res.status >= 500) {
      const wait = 20000 * (attempt + 1);
      console.log(`  ${res.status} for ${id}, waiting ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) {
      console.log(`  ${res.status} for ${id}, skipping`);
      break;
    }
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    ok = true;
  }
  if (ok) done++;
  else failed++;
  if ((done + failed) % 50 === 0) console.log(`${done + failed}/${entries.length}`);
  await sleep(1100);
}
console.log(`Done: ${done} photos in public/items, ${failed} failed.`);
