/**
 * Prepare the shop's video ads for the website.
 *
 * Every byte here is served from Firebase Hosting on the free plan, which allows
 * 360 MB a day across every visitor. A video is by far the heaviest thing that
 * can be put on a page, so the originals are not simply copied across:
 *
 *   - re-encoded at a quality setting chosen for screen viewing rather than for
 *     a disc, which is where most of the saving comes from
 *   - audio dropped to a voice-appropriate bitrate
 *   - the index moved to the front, so a browser can start playing before the
 *     whole file has arrived
 *   - a poster frame taken from the middle and saved as a small image, so the
 *     page shows a picture rather than a black rectangle and downloads nothing
 *     until somebody actually presses play
 *
 * The originals in ../video ads are never touched.
 *
 *   node scripts/prepare-videos.mjs
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const HERE = resolve(fileURLToPath(new URL('.', import.meta.url)));
const FFMPEG = require('ffmpeg-static');

const SOURCE = resolve(HERE, '..', '..', 'video ads');
const OUT = resolve(HERE, '..', 'public', 'videos');
const POSTERS = resolve(HERE, '..', 'public', 'images', 'videos');

/** A readable name for each file, since the originals are named for editing. */
const TITLES = {
  'DAHI MOTU PATLU (Edited)': {
    title: 'Dahi Motu Patlu',
    note: 'Our friends from the neighbourhood, on a pack of Dahi.',
  },
  'ghee (Edited)': {
    title: 'Desi Ghee',
    note: 'Hand-churned from cultured white butter, in small batches.',
  },
  'MILK (Edited)': {
    title: 'Standardised Milk',
    note: 'Full-cream, pasteurised, tested and cold-chained to your door.',
  },
  'PANNER (Edited)': {
    title: 'High Protein Paneer',
    note: 'Set from our own milk. No starch, no vegetable fat.',
  },
};

const run = (args) => execFileSync(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] });

/**
 * ffmpeg prints the stream summary to stderr and then exits non-zero, because
 * no output file was asked for. That is the normal way to probe, so the failure
 * is the expected thing here and its message is the answer.
 */
const seconds = (file) => {
  try {
    execFileSync(FFMPEG, ['-i', file], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    return `${err.stderr || ''}`;
  }
  return '';
};

const kb = (n) => Math.round(n / 1024) + ' KB';
const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';

if (!existsSync(SOURCE)) {
  console.log(`No source folder at ${SOURCE}`);
  process.exit(0);
}
mkdirSync(OUT, { recursive: true });
mkdirSync(POSTERS, { recursive: true });

const files = readdirSync(SOURCE).filter((f) => extname(f).toLowerCase() === '.mp4');
const manifest = [];

for (const file of files) {
  const stem = basename(file, extname(file));
  const slug = stem
    .toLowerCase()
    .replace(/\(edited\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const src = join(SOURCE, file);
  const meta = TITLES[stem] || { title: stem, note: '' };
  const outFile = join(OUT, `${slug}.mp4`);
  const posterFile = join(POSTERS, `${slug}.jpg`);

  // Roughly the middle, so the poster is not a fade-in or a black frame.
  const probe = seconds(src);
  const durLine = probe.split('\n').find((l) => l.includes('Duration:')) || '';
  const parts = durLine.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const at = parts
    ? Math.max(0, Number(parts[1]) * 3600 + Number(parts[2]) * 60 + Number(parts[3]) - 0.5)
    : 0;

  // 1280x720 at a screen-appropriate quality, 24fps kept, audio at voice level.
  run([
    '-y', '-i', src,
    '-vf', "scale='min(1280,iw)':-2",
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '30',
    '-pix_fmt', 'yuv420p',
    '-profile:v', 'main',
    '-movflags', '+faststart',
    '-c:a', 'aac',
    '-b:a', '96k',
    '-ac', '2',
    outFile,
  ]);

  // A small poster, so the page costs almost nothing until somebody plays.
  run([
    '-y', '-ss', String(at), '-i', src,
    '-frames:v', '1',
    '-vf', "scale='min(900,iw)':-2",
    '-q:v', '6',
    posterFile,
  ]);

  // Picture asks the browser for the AVIF and the WebP of a photograph before it
  // falls back to the JPEG. Without those two files the request does not fail -
  // the single-page app answers it with index.html and a 200 - so the browser
  // picks a source it cannot decode and the poster never appears. All three have
  // to exist, not just the JPEG.
  const poster = readFileSync(posterFile);
  for (const [ext, opts] of [
    ['avif', { quality: 50 }],
    ['webp', { quality: 66 }],
  ]) {
    await sharp(poster)
      .toFormat(ext, opts)
      .toFile(join(POSTERS, `${slug}.${ext}`));
  }

  const before = statSync(src).size;
  const after = statSync(outFile).size;
  const posterSize = statSync(posterFile).size;

  manifest.push({
    slug,
    src: `/videos/${slug}.mp4`,
    poster: `/images/videos/${slug}.jpg`,
    title: meta.title,
    note: meta.note,
  });

  console.log(
    `  ${slug.padEnd(14)} ${mb(before).padStart(7)} -> ${mb(after).padStart(7)}` +
      `  (${Math.round((1 - after / before) * 100)}% smaller)   poster ${kb(posterSize)}`
  );
}

const totalBefore = files.reduce((s, f) => s + statSync(join(SOURCE, f)).size, 0);
const totalAfter = manifest.reduce((s, m) => s + statSync(join(OUT, `${m.slug}.mp4`)).size, 0);

/**
 * Writes the list the page reads. Each entry carries both ways of showing the
 * film: `src` for the copy on this site, and `youtube` for a link to a channel
 * upload, which costs the site nothing. Whichever is filled in is what plays, so
 * moving a film to YouTube later is a one-line edit and not a redesign.
 */
const module = `/**
 * The shop's video ads. Written by scripts/prepare-videos.mjs - edit that, not
 * this.
 *
 * Each entry can be shown two ways. \`src\` is a file on this site, compressed
 * and served from Hosting. \`youtube\` is an id from a channel upload, and the
 * picture then streams from there and costs this site no bandwidth at all.
 * Whichever is filled in wins, so a film can move between the two freely.
 *
 * Only one is filled in per film at the moment.
 */
export const VIDEO_ADS = ${JSON.stringify(
  manifest.map((m) => ({ ...m, youtube: '' })),
  null,
  2
)};
`;

writeFileSync(join(HERE, '..', 'src', 'videoAds.js'), module, 'utf8');

console.log(`\n  wrote src/videoAds.js`);
console.log(`  total ${mb(totalBefore)} -> ${mb(totalAfter)}  (${Math.round((1 - totalAfter / totalBefore) * 100)}% smaller)`);
console.log('  these are served from the free plan\'s 360 MB a day, so the page');
console.log('  loads a film only when somebody presses play.');
