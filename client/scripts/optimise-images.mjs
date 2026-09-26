/**
 * Image optimiser.
 *
 * The free Firebase plan serves 360 MB a day, so every kilobyte of JPEG is
 * worth something: a first-time visitor was pulling ~800 KB, mostly photographs.
 * WebP gets the same picture for roughly a fifth of the weight.
 *
 * Run it once after adding or replacing any photograph:
 *   node scripts/optimise-images.mjs
 *
 * It writes a .webp next to each .jpeg, reports the saving, and leaves the
 * originals alone so the comparison stays honest.
 */
import sharp from 'sharp';
import { readdir, stat, unlink } from 'node:fs/promises';
import { join, extname, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'images');

/** Photographs only - the pack illustrations are SVG and already tiny. */
const PHOTO_EXT = new Set(['.jpeg', '.jpg', '.png']);
/**
 * Two modern formats plus the original JPEG kept as a fallback. AVIF is the
 * smallest of the three and every current browser picks it up first; WebP
 * covers the rest. Measured on this site's photographs, AVIF came out around
 * 55% lighter than the source JPEG where WebP managed about 42%.
 */
const TARGETS = [
  { ext: '.avif', format: 'avif', quality: 50 },
  { ext: '.webp', format: 'webp', quality: 66 },
];
/** Photographs are never displayed larger than this. */
const MAX_EDGE = 1400;

/**
 * Shows what each format and quality would cost, so the settings below are a
 * choice rather than a guess:
 *   node scripts/optimise-images.mjs --compare
 */
async function compare(file) {
  const label = basename(file).padEnd(28);
  const raw = (await sharp(file).toBuffer()).length;
  const cells = [];
  for (const q of [82, 74, 66, 58]) {
    const b = await sharp(file).webp({ quality: q, effort: 6 }).toBuffer();
    cells.push(`webp q${q} ${kb(b.length)}KB`);
  }
  for (const q of [60, 50, 42]) {
    const b = await sharp(file).avif({ quality: q, effort: 6 }).toBuffer();
    cells.push(`avif q${q} ${kb(b.length)}KB`);
  }
  console.log(`${label} orig ${kb(raw)}KB  |  ${cells.join('   ')}`);
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

let before = 0;
let after = 0;
let count = 0;
const compareOnly = process.argv.includes('--compare');

for await (const file of walk(ROOT)) {
  if (!PHOTO_EXT.has(extname(file).toLowerCase())) continue;
  if (compareOnly) {
    await compare(file);
    continue;
  }

  const src = await stat(file);
  const stem = basename(file, extname(file));
  const dir = dirname(file);

  const pipeline = () =>
    sharp(file)
      .rotate() // honour any EXIF orientation before stripping metadata
      .resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      });

  const results = [];
  for (const target of TARGETS) {
    const out = join(dir, stem + target.ext);
    const image = pipeline();
    if (target.format === 'avif') image.avif({ quality: target.quality, effort: 6 });
    else image.webp({ quality: target.quality, effort: 6 });
    await image.toFile(out);
    results.push({ ext: target.ext, size: (await stat(out)).size });
  }

  before += src.size;
  after += Math.min(...results.map((r) => r.size));
  count += 1;

  const best = Math.min(...results.map((r) => r.size));
  const saved = Math.round((1 - best / src.size) * 100);
  const detail = results
    .map((r) => `${r.ext.slice(1)} ${kb(r.size)}KB`)
    .join('  ');
  console.log(
    `  ${basename(file).padEnd(28)} ${kb(src.size)} KB  ->  ${detail}   (${saved}% lighter)`
  );
}

if (!count) {
  console.log('No photographs to convert.');
} else {
  console.log(
    `\n  ${count} images: ${kb(before)} KB -> ${kb(after)} KB ` +
      `(saves ${kb(before - after)} KB on every first visit)`
  );
}

/** Frees the space once the new paths are in use. */
if (process.argv.includes('--remove-originals')) {
  for await (const file of walk(ROOT)) {
    if (!PHOTO_EXT.has(extname(file).toLowerCase())) continue;
    const webp = join(dirname(file), `${basename(file, extname(file))}.webp`);
    try {
      await stat(webp);
      await unlink(file);
      console.log(`  removed ${basename(file)}`);
    } catch {
      /* no webp twin, keep the original */
    }
  }
}

function kb(bytes) {
  return Math.round(bytes / 102.4) / 10;
}
