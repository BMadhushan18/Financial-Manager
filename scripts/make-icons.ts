// Generates public/icon-192.png and public/icon-512.png (PWA install icons)
// without any image library: draws the MoneyMind mark and encodes a PNG.
//   npx tsx scripts/make-icons.ts
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

type RGB = [number, number, number];
const INDIGO: RGB = [99, 102, 241];
const WHITE: RGB = [255, 255, 255];
const GREEN: RGB = [34, 197, 94];

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Colour at a point in a 512×512 design space (full-bleed so it works as maskable). */
function sample(x: number, y: number): RGB {
  const stroke = 30 / 2;
  const m: [number, number][] = [
    [196, 316],
    [196, 196],
    [256, 266],
    [316, 196],
    [316, 316],
  ];
  for (let i = 0; i < m.length - 1; i++) {
    const [ax, ay] = m[i]!;
    const [bx, by] = m[i + 1]!;
    if (distToSegment(x, y, ax, ay, bx, by) <= stroke) return WHITE;
  }
  const r = Math.hypot(x - 256, y - 256);
  if (Math.abs(r - 150) <= 14) {
    const angle = Math.atan2(y - 256, x - 256);
    if (angle >= -Math.PI / 2 && angle <= 0) return GREEN;
    return [176, 178, 247];
  }
  return INDIGO;
}

function png(size: number): Buffer {
  const ss = 4; // supersampling for smooth edges
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const c = sample(
            ((x + (sx + 0.5) / ss) * 512) / size,
            ((y + (sy + 0.5) / ss) * 512) / size,
          );
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = Math.round(r / (ss * ss));
      raw[o + 1] = Math.round(g / (ss * ss));
      raw[o + 2] = Math.round(b / (ss * ss));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '../public');
for (const size of [192, 512]) {
  writeFileSync(resolve(outDir, `icon-${size}.png`), png(size));
  console.log(`Wrote public/icon-${size}.png`);
}
