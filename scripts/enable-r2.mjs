/**
 * Switch the partner panel's video upload on.
 *
 * R2 has to be bought in the Cloudflare dashboard first - that is one click and
 * a card, and it cannot be done from a machine: the dashboard needs the owner's
 * own sign-in, and the card number has to be typed by whoever owns the card.
 * Everything after that is here.
 *
 *   node scripts/enable-r2.mjs
 *
 * Three things, in order, stopping at the first that fails:
 *
 *   1. create the bucket
 *   2. put the binding in wrangler.toml - publishing a Function that names a
 *      bucket which does not exist is refused outright, so this cannot be left
 *      as an operator step to remember
 *   3. build and deploy, then check the site says storage is on
 *
 * Safe to run twice. The bucket already existing is not a failure, and the
 * binding is only written if it is not already there.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = resolve(fileURLToPath(new URL('.', import.meta.url)));
const ROOT = resolve(HERE, '..');
const CONFIG = resolve(ROOT, 'wrangler.toml');
const SITE = 'https://maa-saraswati-diary.pages.dev';

const BUCKET = 'maa-videos';
const BINDING = 'VIDEOS';

/** The two blocks that are in the file before R2 is on, and must not both be. */
const COMMENTED = `# [[r2_buckets]]
# binding = "VIDEOS"
# bucket_name = "maa-videos"`;

const LIVE = `[[r2_buckets]]
binding = "VIDEOS"
bucket_name = "${BUCKET}"`;

const step = (line) => console.log('  ' + line);
const fail = (line, detail) => {
  console.log('');
  console.log('  ' + line);
  if (detail) console.log('  ' + detail);
  console.log('');
  process.exit(1);
};

/* ------------------------------------------------------------------ 1. bucket */

step('Creating the video storage bucket...');
const made = spawnSync('npx.cmd', ['wrangler', 'r2', 'bucket', 'create', BUCKET], {
  cwd: ROOT,
  encoding: 'utf8',
  shell: true,
});
const bucketOutput = `${made.stdout || ''}${made.stderr || ''}`;

if (/already exists/i.test(bucketOutput)) {
  step(`  the bucket "${BUCKET}" is already there`);
} else if (made.status !== 0) {
  if (/Please enable R2/i.test(bucketOutput)) {
    fail(
      'R2 has not been bought yet, so there is nowhere to keep the films.',
      'Open ' + SITE + ' -> the partner panel -> Videos, and follow the link to the\n' +
        '  Cloudflare dashboard, or ask whoever is doing this to buy R2 first.'
    );
  }
  fail('The bucket could not be created.', bucketOutput.trim().split('\n').slice(-6).join('\n  '));
} else {
  step(`  the bucket "${BUCKET}" is ready`);
}

/* ----------------------------------------------------------------- 2. binding */

const before = readFileSync(CONFIG, 'utf8');
if (before.includes(LIVE)) {
  step('The binding is already in wrangler.toml');
} else if (before.includes(COMMENTED)) {
  writeFileSync(CONFIG, before.replace(COMMENTED, LIVE), 'utf8');
  step('The binding is now switched on in wrangler.toml');
} else {
  fail(
    'wrangler.toml does not look the way this script expects.',
    'Expected either the live binding or the two commented-out lines that become\n' +
      '  it. Open the file and compare with git history before changing anything.'
  );
}

/* ---------------------------------------------------------------- 3. publish */

step('Building and publishing the site...');
const deploy = spawnSync('npm.cmd', ['run', 'deploy:pages'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: true,
});
if (deploy.status !== 0) {
  fail(
    'The site did not publish. The files on this computer are fine - nothing has',
    'been lost, and running this again will pick up where it stopped.'
  );
}

/* ----------------------------------------------------------------- 4. verify */

step('Checking the site is serving video...');
let body = null;
for (let attempt = 0; attempt < 6 && !body; attempt += 1) {
  await new Promise((r) => setTimeout(r, 3000));
  try {
    const res = await fetch(`${SITE}/api/videos?check=${Date.now()}`, {
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    });
    if (res.ok) body = await res.json();
  } catch {
    /* the site takes a moment to pick a new deployment up */
  }
}

if (!body) {
  fail(
    'The site was published but did not answer in time. This is usually just the',
    'deployment taking a moment. Open ' + SITE + '/partner/products?tab=videos and look.'
  );
}

if (body.available === false) {
  fail(
    'The site is published but video storage still reads as switched off.',
    'The binding is in wrangler.toml, so this is Cloudflare needing a moment.\n' +
      '  Try again in a minute. If it persists, run:  npx wrangler pages deployment list'
  );
}

console.log('');
console.log('  ============================================================');
console.log('     DONE. Video upload is switched on.');
console.log('  ============================================================');
console.log('');
console.log('  Upload a film here:');
console.log('    ' + SITE + '/partner/products?tab=videos');
console.log('');
console.log('  The films already on the video page are still the four that were built');
console.log('  into the site. The first one uploaded from the panel takes over as the');
console.log('  list, so upload the four again when you have a moment - or ask and it');
console.log('  will be done.');
console.log('');
