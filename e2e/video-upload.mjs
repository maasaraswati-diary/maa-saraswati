/**
 * Uploading a film from the panel, and finding it on the public page.
 *
 * This is the whole round trip the panel's Videos tab promises: pick a file, a
 * poster frame is taken from it, it goes to storage, it is listed, and it
 * appears on the site's video page and plays - and then it can be renamed,
 * moved, and removed again.
 *
 * It runs against a local `wrangler pages dev`, which gives a real R2 bucket
 * with no account or card involved, and against the real Firebase sign-in. So
 * the only thing standing between this passing and production is the owner
 * enabling R2 in the dashboard.
 *
 *   SITE_EMAIL=... SITE_PASSWORD=... node e2e/video-upload.mjs
 *
 * SITE_URL points it somewhere other than the local server.
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire('C:/Users/DELL/AppData/Roaming/npm/');
const { chromium } = require('playwright');

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.SITE_URL || 'http://127.0.0.1:8788';
const email = process.env.SITE_EMAIL;
const password = process.env.SITE_PASSWORD;

/** The smallest of the shop's films, so the test is quick. */
const VIDEO = process.env.VIDEO_FILE || join(HERE, '..', 'video ads', 'DAHI MOTU PATLU (Edited).mp4');

if (!email || !password) {
  console.log('No SITE_EMAIL / SITE_PASSWORD - skipping.');
  process.exit(0);
}

mkdirSync(join(HERE, 'artifacts'), { recursive: true });

/**
 * A very small film, made on the spot.
 *
 * Reordering needs two films on the page, and the shop's real ones are megabytes
 * each - enough that a test which uploads several of them spends most of its
 * time moving bytes. Two seconds of 320x180 is a few kilobytes, plays fine, and
 * still has a frame worth taking a poster from.
 */
function tinyFilm(name) {
  const out = join(HERE, 'artifacts', name);
  if (existsSync(out)) return out;
  const ffmpeg = createRequire(join(HERE, '..', 'client', 'package.json'))('ffmpeg-static');
  execFileSync(ffmpeg, [
    '-f', 'lavfi',
    '-i', `color=c=0x0e7a45:s=320x180:d=2`,
    '-f', 'lavfi',
    '-i', 'anullsrc=r=8000:cl=stereo',
    '-shortest',
    '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '40',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '32k',
    '-movflags', '+faststart',
    '-y', out,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  return out;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1380, height: 1000 } });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(String(m.text()).slice(0, 160));
});

const fails = [];
let n = 0;
const check = (ok, what) => {
  n += 1;
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${what}`);
  if (!ok) fails.push(what);
};

const signIn = async () => {
  // The sign-in screen lives at /partner itself; everything under /partner/* is
  // the panel proper and sends you back here when you are not signed in.
  await page.goto(`${BASE}/partner`, { waitUntil: 'domcontentloaded' });
  await page.locator('#pemail').fill(email);
  await page.locator('#ppass').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL(/\/partner\/products/, { timeout: 45000 });
};

/* ---------------------------------------------------------------- the guard */

// Before anything is signed in, the endpoint has to say no. A panel that trusts
// the browser would let anyone who opened devtools replace the films.
{
  const res = await page.request.get(`${BASE}/api/videos`);
  const body = await res.json();
  check(res.status() === 200, 'the list can be read without signing in (the page needs it)');
  check(Array.isArray(body.videos), 'and it is a list');
}

{
  const res = await page.request.post(`${BASE}/api/videos`, {
    headers: { 'Content-Type': 'application/json' },
    data: { title: 'Should not work', file: 'data:video/mp4;base64,AAAA' },
  });
  check(res.status() === 401, `an upload without a token is refused (got ${res.status()})`);
}

{
  const res = await page.request.post(`${BASE}/api/videos`, {
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer not-a-real-token' },
    data: { title: 'Should not work', file: 'data:video/mp4;base64,AAAA' },
  });
  check(res.status() === 401, `an upload with a made-up token is refused (got ${res.status()})`);
}

/* ---------------------------------------------------------------- sign in */

await signIn();
await page.locator('.admin-tabs').first().waitFor({ timeout: 30000 });
check(true, 'the panel opens');

await page.goto(`${BASE}/partner/products?tab=videos`, { waitUntil: 'domcontentloaded' });
await page.locator('.vid-panel').waitFor({ timeout: 30000 });
check(true, 'the Videos tab opens');

await page.screenshot({ path: join(HERE, 'artifacts', 'videos-tab.png'), fullPage: true });

check(
  await page.locator('.admin-tab', { hasText: 'Videos' }).first().isVisible(),
  'the tab is in the menu'
);

/* ---------------------------------------------------------------- upload */

const title = 'Paneer, cut this morning';
await page.setInputFiles('#video-file', VIDEO);
await page.waitForTimeout(500);
check(
  (await page.locator('.drop-zone strong').innerText()).includes('DAHI'),
  'choosing a file shows its name'
);

// The title is offered from the file name; it is changed to something a person
// would actually write, which is the part that has to be respected.
await page.fill('#video-title', title);
await page.fill('#video-note', 'Set from our own milk. No starch, no vegetable fat.');
await page.click('.vid-panel .card.form-card .btn-brand');
await page.waitForSelector('.vid-row', { timeout: 120000 });
check(true, 'the film is uploaded and listed');

const row = page.locator('.vid-row').first();
check((await row.innerText()).includes(title), 'the title that was typed is the one shown');

// The poster is grabbed from the film in the browser. A card with no picture
// still works, so this is the check that the frame was actually taken.
await page.waitForTimeout(1200);
const posterSrc = await row.locator('.vid-thumb img').getAttribute('src').catch(() => null);
check(Boolean(posterSrc && posterSrc.startsWith('/media/posters/')), `a poster was stored (${posterSrc})`);

const posterOk = posterSrc ? await page.request.get(BASE + posterSrc) : { status: () => 0 };
check(posterOk.status() === 200, `the poster is served (${posterOk.status()})`);

await page.screenshot({ path: join(HERE, 'artifacts', 'videos-uploaded.png'), fullPage: true });

/* ---------------------------------------------------------------- serving */

const listed = await (await page.request.get(`${BASE}/api/videos`)).json();
check(listed.videos.length >= 1, `the list has the film (${listed.videos.length})`);

const film = listed.videos.find((v) => v.title === title);
check(Boolean(film), 'and it is in there under that title');
check(film && film.poster.startsWith('/media/posters/'), 'with a poster recorded');
check(film && film.size > 500000, `and a real file size (${film && Math.round(film.size / 1024)} KB)`);

{
  const full = await page.request.get(BASE + film.src);
  check(full.status() === 200, `the film is served (${full.status()})`);
  check(
    (full.headers()['content-type'] || '').startsWith('video/'),
    `as a video (${full.headers()['content-type']})`
  );
  check(full.headers()['accept-ranges'] === 'bytes', 'and says it accepts ranges');

  // Seeking is the reason the Range header is passed through. Without a 206 the
  // viewer has to wait for the whole film before it can move.
  const part = await page.request.get(BASE + film.src, { headers: { Range: 'bytes=0-1023' } });
  check(part.status() === 206, `a range request is answered with 206 (got ${part.status()})`);
  check(
    /^bytes 0-1023\//.test(part.headers()['content-range'] || ''),
    `and says what it sent (${part.headers()['content-range']})`
  );
  check((await part.body()).length === 1024, 'and it is exactly the bytes asked for');
}

{
  // Anything that is not one of the shop's own films must not be served, and
  // neither must a name that tries to climb out of its own folder.
  //
  // The dots are written %2e so the path reaches the server as typed. A plain
  // "../" is tidied away by the HTTP client before it is ever sent, so a test
  // using one proves nothing about the server.
  const attempts = [
    '/media/videos/%2e%2e%2f%2e%2e%2findex.json',
    '/media/videos/index.json',
    '/media/anything.txt',
    '/media/videos/gone.mp4',
    '/media/videos/UPPER.mp4',
  ];
  for (const bad of attempts) {
    const res = await page.request.get(BASE + bad);
    check(res.status() === 404, `${bad} is refused (${res.status()})`);
  }

  // A name that resolves outside /media never reaches the serving route at all -
  // the path is settled before routing, so the answer is the site's own page
  // rather than an error. What matters is that the list of films, which is the
  // one thing worth stealing, is not in it.
  const climb = await page.request.get(BASE + '/media/%2e%2e/index.json');
  const body = await climb.text();
  check(!body.includes('"videos"'), 'and the list of films cannot be reached that way');
  check(
    !(climb.headers()['content-type'] || '').includes('json'),
    `what comes back is not the list (${climb.headers()['content-type']})`
  );
}

/* ---------------------------------------------------------------- the page */

await page.goto(`${BASE}/videos`, { waitUntil: 'domcontentloaded' });
await page.locator('.vcard').first().waitFor({ timeout: 30000 });
await page.waitForTimeout(1500);

const cards = await page.locator('.vcard').count();
check(cards >= 1, `the video page shows ${cards} film(s)`);
check(
  (await page.locator('.vcard').allInnerTexts()).some((t) => t.includes(title)),
  'and the uploaded one is among them'
);

const src = await page.locator('.vcard-video').count()
  ? await page.locator('.vcard-video').first().getAttribute('src')
  : await page.locator('.vcard-poster').first().locator('img').getAttribute('src');
check(Boolean(src), `the card points at a real file (${src})`);

// Clicking must swap the poster for a player that actually plays.
const target = page.locator('.vcard').filter({ hasText: title }).first();
await target.locator('.vcard-poster').click();
await target.locator('.vcard-video').waitFor({ timeout: 20000 });
await page.waitForTimeout(3000);
check(await target.locator('.vcard-video').evaluate((v) => !v.paused), 'the film plays on the page');

await page.screenshot({ path: join(HERE, 'artifacts', 'videos-public.png'), fullPage: true });

/* ---------------------------------------------------------------- rename */

await page.goto(`${BASE}/partner/products?tab=videos`, { waitUntil: 'domcontentloaded' });
await page.locator('.vid-row').first().waitFor({ timeout: 30000 });

await row.locator('button[title="Change the title"]').click();
await page.locator('.vid-row input.input').first().fill('Paneer, cut this morning (new)');
await page.locator('.vid-row .btn-brand').click();
await page.waitForTimeout(2500);
check(
  (await page.locator('.vid-row').first().innerText()).includes('(new)'),
  'a film can be renamed'
);

/* ---------------------------------------------------------------- reorder */

// A second film, so there is an order to change. It is a few kilobytes rather
// than megabytes - the point is the ordering, not the picture.
const second = 'Ghee, churned by hand';
{
  const tiny = tinyFilm('tiny-ghee.mp4');
  await page.setInputFiles('#video-file', tiny);
  await page.waitForTimeout(400);
  await page.fill('#video-title', second);
  await page.fill('#video-note', 'From cultured white butter, in small batches.');
  await page.click('.vid-panel .card.form-card .btn-brand');
  await page.waitForFunction(
    () => document.querySelectorAll('.vid-row').length >= 2,
    null,
    { timeout: 120000 }
  );
  check(true, 'a second film is added');

  const newestFirst = await page.locator('.vid-row').allInnerTexts();
  check(newestFirst[0].includes(second), 'the newest film is at the top of the list');

  // Move it down. The panel sends the whole order, so the order on screen and the
  // order stored cannot fall out of step.
  await page.locator('.vid-row').first().locator('button[title="Move down"]').click();
  await page.waitForTimeout(2500);

  const afterMove = await page.locator('.vid-row').allInnerTexts();
  check(afterMove[1].includes(second), 'a film can be moved down');
  check(afterMove[0].includes('(new)'), 'and the one above it moved up');

  const stored = (await (await page.request.get(`${BASE}/api/videos`)).json()).videos;
  check(stored[1].title === second, 'and the new order is what was stored');

  // And the public page follows it.
  await page.goto(`${BASE}/videos`, { waitUntil: 'domcontentloaded' });
  await page.locator('.vcard').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  const order = await page.locator('.vcard').allInnerTexts();
  check(
    order[1].includes(second),
    'and the website shows the films in that order too'
  );
}

await page.goto(`${BASE}/partner/products?tab=videos`, { waitUntil: 'domcontentloaded' });
await page.locator('.vid-row').first().waitFor({ timeout: 30000 });

/* ---------------------------------------------------------------- remove */

// Both films come off again, and the bucket is left as it was found.
let askedAboutRemoving = false;
while ((await page.locator('.vid-row').count()) > 0) {
  const count = await page.locator('.vid-row').count();
  page.once('dialog', (d) => d.accept());
  await page.locator('.vid-row').first().locator('button[title="Remove this film"]').click();
  await page.locator('.modal').waitFor({ timeout: 10000 });
  if (!askedAboutRemoving) {
    check(true, 'removing asks first, because it cannot be undone');
    askedAboutRemoving = true;
  }
  await page.locator('.modal .btn-red').click();
  await page.waitForFunction(
    (left) => document.querySelectorAll('.vid-row').length < left,
    count,
    { timeout: 30000 }
  );
}

const after = await (await page.request.get(`${BASE}/api/videos`)).json();
check(after.videos.length === 0, `every film is off the page again (${after.videos.length} left)`);
check(
  !after.videos.some((v) => v.title.includes('(new)')),
  'including the one that was renamed'
);

{
  const res = await page.request.get(BASE + film.src);
  check(res.status() === 404, `and the file itself is gone (${res.status()})`);
  const poster = await page.request.get(BASE + film.poster);
  check(poster.status() === 404, `poster frame too (${poster.status()})`);
}

/* ---------------------------------------------------------------- errors */

check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors[0] : ''));

console.log(`\n${n - fails.length}/${n} passed`);
if (fails.length) console.log('failed: ' + fails.join(' | '));
await browser.close();
process.exit(fails.length ? 1 : 0);
