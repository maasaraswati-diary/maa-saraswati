/**
 * Add, change or remove a film on the website, by double-clicking one file.
 *
 * The panel can do this too, but only once Cloudflare's R2 storage is switched
 * on, and R2 asks for a card even on its free tier. This is the route that
 * needs nothing: a film is compressed, given a poster, written into the site
 * and published. The shop is on a free Cloudflare Pages plan, which serves an
 * unlimited number of films with no ceiling on how many people watch.
 *
 *   node scripts/add-video.mjs
 *
 * The owner runs the "Add Video" file next to this project and answers three
 * questions. Everything else - the compression settings, the poster, the page
 * itself, the upload - is already decided here.
 *
 * Flags, for running it without asking anything:
 *
 *   --file <path>    use this film instead of opening a file picker
 *   --title <text>   skip the title question
 *   --note <text>    skip the note question
 *   --remove <slug>  take a film off the page without asking
 *   --list           print what is on the page and stop
 *   --yes            publish without asking first
 */
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const HERE = resolve(fileURLToPath(new URL('.', import.meta.url)));
const CLIENT = resolve(HERE, '..');
const ROOT = resolve(CLIENT, '..');
const FFMPEG = require('ffmpeg-static');

const OUT = join(CLIENT, 'public', 'videos');
const POSTERS = join(CLIENT, 'public', 'images', 'videos');
const MANIFEST = join(CLIENT, 'src', 'videoAds.js');
const SITE = 'https://maa-saraswati-diary.pages.dev';

const argv = process.argv.slice(2);

/**
 * The value that follows a flag, e.g. flag('title') for "--title Fresh Paneer".
 *
 * The dashes are added here rather than at each call. Written the other way round
 * - flag('title') in one place and flag('title') in another - a flag is
 * silently ignored, and it is ignored by falling back to a default, so the run
 * looks exactly like it worked.
 */
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

/** Was a flag given at all? */
const has = (name) => argv.includes(`--${name}`);

/* ------------------------------------------------------------------ output */

// Plain ASCII throughout. A command window on Windows will happily print a box
// drawing or a tick and then print it again as two question marks, which makes a
// tool look broken when it is working perfectly.
const say = (line = '') => console.log(line);
const step = (line) => console.log('  ' + line);
const rule = () => say('  ' + '-'.repeat(58));

/**
 * Reading answers, one line at a time.
 *
 * rl.question() is the obvious way to ask, and it is wrong here. When the answers
 * arrive faster than the questions - a pipe, a script, a held-down key - it hands
 * the first line to the first question and throws the rest away, so every later
 * question silently falls back to its default. That reads as "it worked" while
 * the film is named after its file.
 *
 * So lines are queued as they arrive and each question takes one, in order,
 * however they turn up.
 */
const waiting = [];
const spare = [];
let waitingFor = null;

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });

rl.on('line', (line) => {
  if (waitingFor) {
    const give = waitingFor;
    waitingFor = null;
    give(line);
  } else {
    spare.push(line);
  }
});
// Nothing more is coming: anyone still waiting gets nothing, and a question
// falls back rather than hanging for ever.
rl.on('close', () => {
  if (waitingFor) {
    const give = waitingFor;
    waitingFor = null;
    give('');
  }
});

const readLine = () => (spare.length ? Promise.resolve(spare.shift()) : new Promise((r) => {
  waitingFor = r;
}));

/** A question with a default, answered by typing. */
const ask = async (question, fallback = '') => {
  process.stdout.write(`  ${question}${fallback ? ` [${fallback}]` : ''}: `);
  const answer = (await readLine()).trim();
  return answer || fallback;
};

/** A yes/no question. The default is what happens on a bare Enter. */
const askYesNo = async (question, fallback = true) => {
  process.stdout.write(`  ${question} (${fallback ? 'Y/n' : 'y/N'}) `);
  const answer = (await readLine()).trim().toLowerCase();
  if (!answer) return fallback;
  return answer === 'y' || answer === 'yes';
};

/* -------------------------------------------------------------- the manifest */

/**
 * The list of films, read back out of the file that holds it.
 *
 * It is written as `export const VIDEO_ADS = [...];`, so the array is found by
 * its brackets rather than by evaluating the file - which would mean trusting a
 * generated file with the ability to run code.
 */
function readManifest() {
  if (!existsSync(MANIFEST)) return [];
  const text = readFileSync(MANIFEST, 'utf8');
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end < start) return [];
  try {
    const list = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeManifest(videos) {
  const file = `/**
 * The shop's video ads. Written by scripts/prepare-videos.mjs and
 * scripts/add-video.mjs - edit those, not this.
 *
 * Each entry can be shown two ways. \`src\` is a file on this site, compressed
 * and served from Cloudflare Pages. \`youtube\` is an id from a channel upload,
 * and the picture then streams from there and costs this site no bandwidth at
 * all. Whichever is filled in wins, so a film can move between the two freely.
 *
 * These are the films that were built into the site. Once films are uploaded
 * through the partner panel they are listed there instead, and this file is only
 * ever what the video page falls back to.
 */
export const VIDEO_ADS = ${JSON.stringify(
    videos.map((v) => ({
      slug: v.slug,
      src: v.src,
      poster: v.poster,
      title: v.title,
      note: v.note || '',
      youtube: v.youtube || '',
    })),
    null,
    2
  )};
`;
  writeFileSync(MANIFEST, file, 'utf8');
}

/* ------------------------------------------------------------- a file picker */

/**
 * The ordinary Windows "choose a file" window.
 *
 * Asking somebody to type a full path is a good way to lose them. This is the
 * dialog they already know, and it filters to films so they cannot pick a photo
 * by mistake.
 */
function pickFile() {
  const ps = [
    'Add-Type -AssemblyName System.Windows.Forms;',
    '$d = New-Object System.Windows.Forms.OpenFileDialog;',
    "$d.Title = 'Choose your video';",
    "$d.Filter = 'Video files (*.mp4;*.webm;*.mov;*.m4v)|*.mp4;*.webm;*.mov;*.m4v|All files (*.*)|*.*';",
    'if ($d.ShowDialog() -eq "OK") { Write-Output $d.FileName }',
  ].join(' ');

  const result = spawnSync(
    'powershell',
    ['-NoProfile', '-STA', '-Command', ps],
    { encoding: 'utf8' }
  );
  const file = (result.stdout || '').trim();
  return file && existsSync(file) ? file : null;
}

/* ----------------------------------------------------------------- preparing */

const run = (args) => execFileSync(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] });

/**
 * How long the film is, in seconds.
 *
 * ffmpeg prints the stream summary to stderr and then exits non-zero, because
 * no output file was asked for. That is the normal way to probe, so the failure
 * is the expected thing here and its message is the answer.
 */
function seconds(file) {
  let out = '';
  try {
    execFileSync(FFMPEG, ['-i', file], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    out = `${err.stderr || ''}`;
  }
  const line = out.split('\n').find((l) => l.includes('Duration:')) || '';
  const m = line.match(/Duration: (\d+):(\d+):([\d.]+)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
}

const mb = (n) => (n / 1048576).toFixed(2) + ' MB';
const kb = (n) => Math.round(n / 1024) + ' KB';

/** A name usable as a file name, taken from the title. */
function slugify(text) {
  return (
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'video'
  );
}

/**
 * Compress the film and take a poster from it.
 *
 * 1280x720 at a screen-appropriate quality, audio at voice level, and the index
 * moved to the front so a browser can start playing before the whole file has
 * arrived. A film is by far the heaviest thing on the site, so this is where
 * nearly all of the saving comes from. The original is never touched.
 */
async function prepare(src, slug) {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(POSTERS, { recursive: true });

  const video = join(OUT, `${slug}.mp4`);
  const posterJpg = join(POSTERS, `${slug}.jpg`);

  // Near the end rather than the middle: a film's opening is very often a title
  // card, and the end of a shop film is the product itself.
  const at = Math.max(0, seconds(src) - 0.6);

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
    video,
  ]);

  run([
    '-y', '-ss', String(at), '-i', src,
    '-frames:v', '1',
    '-vf', "scale='min(900,iw)':-2",
    '-q:v', '6',
    posterJpg,
  ]);

  // Picture asks the browser for the AVIF and the WebP of a photograph before it
  // falls back to the JPEG. Without those two files the request does not fail -
  // the single-page app answers it with index.html and a 200 - so the browser
  // picks a source it cannot decode and the poster never appears. All three have
  // to exist, not just the JPEG.
  const bytes = readFileSync(posterJpg);
  for (const [ext, options] of [
    ['avif', { quality: 50 }],
    ['webp', { quality: 66 }],
  ]) {
    await sharp(bytes)
      .toFormat(ext, options)
      .toFile(join(POSTERS, `${slug}.${ext}`));
  }

  return { video, posterJpg };
}

/** Delete everything belonging to a film. */
function removeFiles(slug) {
  const gone = [];
  for (const file of [
    join(OUT, `${slug}.mp4`),
    join(POSTERS, `${slug}.jpg`),
    join(POSTERS, `${slug}.webp`),
    join(POSTERS, `${slug}.avif`),
  ]) {
    if (existsSync(file)) {
      unlinkSync(file);
      gone.push(file);
    }
  }
  return gone;
}

/* --------------------------------------------------------------- publishing */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The first video file sitting in a folder, so the common case needs no typing. */
function anyVideoIn(sourceDir) {
  if (!existsSync(sourceDir)) return null;
  const found = readdirSync(sourceDir)
    .filter((f) => /\.(mp4|webm|mov|m4v)$/i.test(f))
    .map((f) => join(sourceDir, f))
    .filter((f) => statSync(f).isFile());
  return found[0] || null;
}

function publish() {
  step('Building the website...');
  const build = spawnSync('npm.cmd', ['run', 'build'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
  });
  if (build.status !== 0) {
    say('');
    say('  The build did not finish. Nothing has been changed on the website.');
    return false;
  }

  step('Uploading to Cloudflare...');
  const deploy = spawnSync(
    'npx.cmd',
    ['wrangler', 'pages', 'deploy', 'client/dist', '--project-name', 'maa-saraswati-diary', '--branch', 'main'],
    { cwd: ROOT, stdio: 'inherit', shell: true }
  );
  return deploy.status === 0;
}

/* ---------------------------------------------------------------------- run */


say('');
say('  ============================================================');
say('     ADD A VIDEO TO THE WEBSITE');
say('     Maa Saraswati, Gurdaspur');
say('  ============================================================');
say('');

let videos = readManifest();

/* The panel's list, if there is one. Once films are uploaded through the
   partner panel they are what the page shows, and this script's list is quietly
   ignored - which would look exactly like the film having been added and then
   lost. Better to say so now. */
let panelIsInCharge = false;
try {
  const res = await fetch(`${SITE}/api/videos`, { signal: AbortSignal.timeout(8000) });
  if (res.ok) {
    const data = await res.json();
    panelIsInCharge = Boolean(data.available && Array.isArray(data.videos) && data.videos.length);
  }
} catch {
  /* offline is fine; the list below still works */
}

if (has('list') || (!flag('file') && !flag('remove') && !has('yes'))) {
  rule();
  say('  On the website right now:');
  if (videos.length) {
    for (const v of videos) {
      const file = join(OUT, basename(v.src));
      const size = existsSync(file) ? mb(statSync(file).size) : 'file missing';
      say(`    ${v.title}`);
      if (v.note) say(`      ${v.note}`);
      say(`      ${size}   (${v.slug})`);
    }
  } else {
    say('    (no films built into the site)');
  }
  if (panelIsInCharge) {
    say('');
    say('    The panel is in charge: films have been uploaded through the');
    say('    partner panel, and the page shows those instead of this list.');
  }
  rule();
  say('');
  // --list was a question in itself; nothing follows it.
  if (has('list')) {
    rl.close();
    process.exit(0);
  }
}

/* ------------------------------------------------------------------- remove */

if (flag('remove')) {
  const slug = flag('remove');
  const found = videos.find((v) => v.slug === slug);
  if (!found) {
    say(`  There is no film called "${slug}" on the page.`);
    say(`  The films are: ${videos.map((v) => v.slug).join(', ') || '(none)'}`);
    rl.close();
    process.exit(1);
  }
  videos = videos.filter((v) => v.slug !== slug);
  writeManifest(videos);
  const gone = removeFiles(slug);
  step(`Removed "${found.title}" and ${gone.length} file(s) from the computer.`);
  if (!has('yes')) {
    if (!(await askYesNo('Put it on the website now?', true))) {
      say('');
      say('  Changed on this computer only. Run this again when you want it live.');
      rl.close();
      process.exit(0);
    }
  }
  if (publish()) {
    say('');
    say('  Done. The film is off the website: ' + SITE + '/videos');
  }
  rl.close();
  process.exit(0);
}

/* --------------------------------------------------------------------- add */

let source = flag('file');

if (!source) {
  // The films sitting in the project's own folder are the ones most likely to be
  // wanted next, so they are offered before opening a file dialog.
  const ready = anyVideoIn(join(ROOT, 'video ads'));
  if (ready && (await askYesNo(`Use the video in the "video ads" folder?\n    ${basename(ready)}`, true))) {
    source = ready;
  } else {
    say('  Opening the file picker...');
    source = pickFile();
  }
}

if (!source) {
  say('  Nothing was chosen. Nothing has been changed.');
  rl.close();
  process.exit(0);
}

if (!existsSync(source)) {
  say(`  There is no file at ${source}`);
  rl.close();
  process.exit(1);
}

const originalSize = statSync(source).size;
say('');
rule();
say(`  Chosen: ${basename(source)}  (${mb(originalSize)})`);
rule();

const suggested = basename(source, extname(source))
  .replace(/\(edited\)/gi, '')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 80);

const title = flag('title') || (await ask('What is this film called?', suggested));
const note = flag('note') ?? (await ask('One line about it (optional - press Enter to skip)', ''));

if (!title.trim()) {
  say('  A film needs a title. Nothing has been changed.');
  rl.close();
  process.exit(1);
}

let slug = slugify(title);
// Two films with the same title must not overwrite each other.
let n = 2;
while (videos.some((v) => v.slug === slug) || existsSync(join(OUT, `${slug}.mp4`))) {
  slug = `${slugify(title)}-${n}`;
  n += 1;
  if (n > 50) break;
}

say('');
say('  Compressing. This takes a minute for a long film...');

let made;
try {
  made = await prepare(source, slug);
} catch (err) {
  say('');
  say('  That file could not be read as a video.');
  say('  MP4 and WebM work. If it came from a phone, try saving it again as MP4.');
  const detail = (err.stderr || err.message || '').toString().trim().split('\n').slice(-3).join(' ');
  if (detail) say('  ' + detail);
  // Anything ffmpeg managed to write before giving up is taken away again. A
  // half-written film left in the folder is picked up as a fresh film next time,
  // and the person is told about a file they have never seen.
  const left = removeFiles(slug);
  if (left.length) say(`  Cleaned up ${left.length} unfinished file(s).`);
  rl.close();
  process.exit(1);
}

const newSize = statSync(made.video).size;
const posterSize = statSync(made.posterJpg).size;

videos = [
  { slug, src: `/videos/${slug}.mp4`, poster: `/images/videos/${slug}.jpg`, title: title.trim(), note: note.trim() },
  ...videos,
];
writeManifest(videos);

step(`Compressed:  ${mb(originalSize)}  ->  ${mb(newSize)}  (${Math.round((1 - newSize / originalSize) * 100)}% smaller)`);
step(`Poster made: ${kb(posterSize)}`);
step(`Added as:    "${title.trim()}"`);
say('');

if (panelIsInCharge) {
  say('  NOTE: the partner panel is in charge of the video page at the moment,');
  say('  so the page will keep showing the films uploaded there. This film is on');
  say('  the website ready to use, and will show once the panel list is empty.');
  say('');
}

if (has('yes') || (await askYesNo('Put it on the website now?', true))) {
  if (publish()) {
    say('');
    say('  Done. Your film is live:');
    say('    ' + SITE + '/videos');
    say('');
    say('  Your original is untouched - it is still exactly where you left it.');
  }
} else {
  say('');
  say('  Saved on this computer. Run "Add Video" again, or tell me, to put it live.');
}

rl.close();



