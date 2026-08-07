/**
 * Generate the raster PWA icons for a product from its SVG-style geometry.
 *
 * The sites ship no image toolchain and no runtime dependencies, so the icons
 * are drawn with the tiny PNG encoder in scripts/lib/png.js and committed to
 * assets/icons/<product>/. Re-run only when the artwork changes:
 *
 *   node scripts/make-icons.js tea
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Canvas, roundedRect } from './lib/png.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** Artwork per product: a mark drawn on a rounded, gradient tile. */
const ART = {
  tea: {
    from: hex('#7fc47f'),
    to: hex('#2f6b36'),
    leaf: hex('#eaf6e6'),
    vein: hex('#2f6b36'),
  },
};

/**
 * Is (x, y) inside a leaf? The leaf is the lens-shaped intersection of two
 * circles, rotated 35° so it points up-right, in a unit square coordinate
 * space centred on (0.5, 0.5) and scaled by `size`.
 */
function leafShape(cx, cy, size, angleDeg = -35) {
  const a = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const R = size * 0.62;
  const d = size * 0.36;
  return (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const lx = dx * cos + dy * sin;
    const ly = -dx * sin + dy * cos;
    return (lx + d) ** 2 + ly ** 2 <= R * R && (lx - d) ** 2 + ly ** 2 <= R * R;
  };
}

/** The leaf's midrib: a thin band along the leaf's long axis, clipped to it. */
function veinShape(cx, cy, size, angleDeg = -35) {
  const a = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const halfWidth = size * 0.028;
  const halfLength = size * 0.42;
  const leaf = leafShape(cx, cy, size, angleDeg);
  return (x, y) => {
    if (!leaf(x, y)) return false;
    const dx = x - cx;
    const dy = y - cy;
    const lx = dx * cos + dy * sin;
    const ly = -dx * sin + dy * cos;
    return Math.abs(lx) <= halfWidth && Math.abs(ly) <= halfLength;
  };
}

function tile(size, art, { markScale = 0.62, radius = size * 0.22, bleed = false } = {}) {
  const canvas = new Canvas(size, size);
  const inside = bleed ? () => true : roundedRect(0, 0, size, size, radius);
  canvas.gradient(art.from, art.to, inside);
  const mark = size * markScale;
  canvas.fill(art.leaf, leafShape(size / 2, size / 2, mark));
  canvas.fill(art.vein, veinShape(size / 2, size / 2, mark), 0.85);
  return canvas;
}

function banner(width, height, art) {
  const canvas = new Canvas(width, height);
  canvas.gradient(art.from, art.to);
  const mark = Math.min(width, height) * 0.62;
  canvas.fill(art.leaf, leafShape(width / 2, height / 2, mark));
  canvas.fill(art.vein, veinShape(width / 2, height / 2, mark), 0.85);
  return canvas;
}

async function main() {
  const id = process.argv[2];
  const art = ART[id];
  if (!art) {
    console.error(`No artwork defined for "${id}". Known: ${Object.keys(ART).join(', ')}`);
    process.exit(1);
  }
  const out = join(ROOT, 'assets', 'icons', id);
  await mkdir(out, { recursive: true });

  const files = {
    'icon-192.png': tile(192, art).toPng(),
    'icon-512.png': tile(512, art).toPng(),
    // Maskable icons are cropped to a circle, so the mark must stay well inside
    // the 80% safe zone and the background must bleed to the edges.
    'icon-maskable-512.png': tile(512, art, { markScale: 0.42, bleed: true }).toPng(),
    'og-image.png': banner(1200, 630, art).toPng(),
  };

  for (const [name, buf] of Object.entries(files)) {
    await writeFile(join(out, name), buf);
    console.log(`[make-icons] wrote assets/icons/${id}/${name} (${buf.length} bytes)`);
  }
}

main().catch((err) => {
  console.error('[make-icons] fatal:', err);
  process.exit(1);
});
