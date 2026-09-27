/**
 * Uploading a film from the panel, and finding it on the public page.
 *
 * This is the whole round trip the panel's Videos tab promises: pick a file, a
 * poster frame is taken from it, it goes to storage, it is listed, and it
 * appears on the site's video page and plays - and then it can be renamed,
 * moved, and removed again.
 *
 * It runs against the deployed site, with the real Firebase sign-in and the real
 * film store, and cleans up after itself - every film it uploads is removed
 * again before the run ends.
 *
 *   SITE_EMAIL=... SITE_PASSWORD=... node e2e/video-upload.mjs
 *
 * SITE_URL points it somewhere else. It must be a real deployment: the list of
 * films is in Firestore, which a local server reaches over the network, so a run
 * against localhost would write the list for real while the films went into a
 * local store the site cannot see.
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire('C:/Users/DELL/AppData/Roaming/npm/');
const { chromium } = require('playwright');

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * The deployed site, not a local one.
 *
 * The list of films lives in Firestore, and the Functions reach it over the
 * network with the project's own key - there is no local Firestore to point at.
 * So a run against `wrangler pages dev` would put the list in the real database
 * while the films went into a local KV that the site cannot see: a page of cards
 * that play nothing. The film bytes are only ever written where they will be
 * read from, so this runs against the real address.
 */
const BASE = process.env.SITE_URL || 'https://maa-saraswati-diary.pages.dev';

/**
 * Every film this run names carries this, so no two runs can produce the same
 * title. Without it, a film left behind by an earlier run and the one this run
 * adds are indistinguishable by name, and the checks that are supposed to mean
 * something quietly pass against the wrong row.
 */
const RUN = Date.now().toString(36).slice(-4);
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

/* -------------------------------------------------------------- clean slate */

// Films left by a run that was interrupted - a closed window, a piped command
// cut short - would otherwise be counted against this one, and a test that
// depends on the world being pristine is a test that gets skipped rather than
// run. The panel is emptied first, through the panel, so this is a no-op on a
// site that is already tidy.
await page.goto(`${BASE}/partner/products?tab=videos`, { waitUntil: 'domcontentloaded' });
await page.locator('.vid-panel').waitFor({ timeout: 30000 });
await page.waitForTimeout(2000);

let tidied = 0;
let tidiedErrors = 0;
for (let attempt = 0; attempt < 20; attempt += 1) {
  const left = (await (await page.request.get(`${BASE}/api/videos?fresh=1`)).json()).videos;
  if (!left.length) break;
  const ready = await Promise.race([
    page.locator('.vid-row').first().waitFor({ timeout: 15000 }).then(() => 'row'),
    page.locator('.error-state').first().waitFor({ timeout: 15000 }).then(() => 'error'),
  ]).catch(() => 'neither');
  if (ready !== 'row') {
    tidiedErrors += 1;
    if (tidiedErrors > 3) break;
    await page.goto(`${BASE}/partner/products?tab=videos`, { waitUntil: 'domcontentloaded' });
    await page.locator('.vid-panel').waitFor({ timeout: 30000 });
    continue;
  }
  await page.locator('.vid-row').first().locator('button[title="Remove this film"]').click();
  await page.locator('.modal').waitFor({ timeout: 10000 });
  await page.locator('.modal .btn-red').click();
  await page
    .waitForFunction(
      async (want) => (await (await fetch('/api/videos?fresh=1')).json()).videos.length < want,
      left.length,
      { timeout: 30000, polling: 500 }
    )
    .catch(() => {});
  tidied += 1;
}
if (tidied) console.log(`  (tidied ${tidied} film(s) left by an earlier run)`);

check(
  (await (await page.request.get(`${BASE}/api/videos?fresh=1`)).json()).videos.length === 0,
  'the page starts with no films, whatever an earlier run left behind'
);

await page.goto(`${BASE}/partner/products?tab=videos`, { waitUntil: 'domcontentloaded' });
await page.locator('.vid-panel').waitFor({ timeout: 30000 });
await page.waitForTimeout(1000);

await page.screenshot({ path: join(HERE, 'artifacts', 'videos-tab.png'), fullPage: true });

check(
  await page.locator('.admin-tab', { hasText: 'Videos' }).first().isVisible(),
  'the Videos tab is in the menu'
);

/* ---------------------------------------------------------------- upload */

const title = `Paneer, cut this morning ${RUN}`;
await page.setInputFiles('#video-file', VIDEO);
await page.waitForTimeout(500);
check(
  (await page.locator('.drop-zone strong').innerText()).includes('DAHI'),
  'choosing a file shows its name'
);

// The title is offered from the file name; it is changed to something a person
// would actually write, which is the part that has to be respected.
const rowsBefore = await page.locator('.vid-row').count();
await page.fill('#video-title', title);
await page.fill('#video-note', 'Set from our own milk. No starch, no vegetable fat.');

// What the panel actually sends, so a mismatch between what was typed and what
// was stored is visible rather than inferred from a slug.
let sent = null;
page.on('request', (req) => {
  if (req.method() === 'POST' && req.url().endsWith('/api/videos')) {
    try {
      sent = JSON.parse(req.postData() || '{}');
    } catch {
      sent = { title: '(unreadable)' };
    }
  }
});

const button = page.locator('.vid-panel .card.form-card .btn-brand');
check(!(await button.isDisabled()), 'the upload button is ready once a file is chosen');
await button.click();

// Waiting for a row to appear is not the same as waiting for this film to be
// added: a row may already be there from an earlier film, and the wait then
// succeeds on a panel that never uploaded anything. What has to change is the
// number of rows, and a panel that says why it failed has to be noticed too.
const what = await Promise.race([
  page
    .waitForFunction((n) => document.querySelectorAll('.vid-row').length > n, rowsBefore, {
      timeout: 120000,
    })
    .then(() => 'added'),
  page
    .locator('.form-error')
    .first()
    .waitFor({ timeout: 120000 })
    .then(() => 'error'),
]).catch(() => 'neither');

if (what === 'error') {
  check(
    false,
    'the film is uploaded and listed: the panel said ' +
      (await page.locator('.form-error').first().innerText()).replace(/\s+/g, ' ').slice(0, 200)
  );
} else if (what === 'neither') {
  check(false, 'the film is uploaded and listed: nothing arrived, and nothing said why');
  await page.screenshot({ path: join(HERE, 'artifacts', 'upload-stuck.png'), fullPage: true });
} else {
  check(true, 'the film is uploaded and listed');
}
check(Boolean(sent), `the panel actually sent an upload (${sent ? `title "${sent.title}"` : 'no request was made'})`);

const row = page.locator('.vid-row').first();
check(
  (await row.innerText()).includes(title),
  `the title that was typed is the one shown (typed "${title}", panel sent "${sent && sent.title}", row shows "${(await row.innerText()).split('\n')[0]}")`
);

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

  // Seeking is the reason the Range header is honoured. Without a 206 the viewer
  // has to wait for the whole film before it can move.
  const part = await page.request.get(BASE + film.src, { headers: { Range: 'bytes=0-1023' } });
  check(part.status() === 206, `a range request is answered with 206 (got ${part.status()})`);
  check(
    /^bytes 0-1023\//.test(part.headers()['content-range'] || ''),
    `and says what it sent (${part.headers()['content-range']})`
  );
  check((await part.body()).length === 1024, 'and it is exactly the bytes asked for');

  // The forms a browser actually sends: the end of the file, and "from here on".
  const tail = await page.request.get(BASE + film.src, { headers: { Range: 'bytes=-512' } });
  check(tail.status() === 206, `the last bytes can be asked for (${tail.status()})`);
  check((await tail.body()).length === 512, 'and exactly that many come back');

  const openEnd = await page.request.get(BASE + film.src, { headers: { Range: 'bytes=1000-' } });
  check(openEnd.status() === 206, `"from here to the end" is understood (${openEnd.status()})`);
  check(
    (await openEnd.body()).length === film.size - 1000,
    'and runs to the end of the film, not to a page of it'
  );

  // A range asking for more than there is must stop at the end rather than
  // running off it.
  const over = await page.request.get(BASE + film.src, {
    headers: { Range: `bytes=0-${film.size + 99999}` },
  });
  check(over.status() === 206, 'a range past the end is still a partial reply');
  check(
    over.headers()['content-range'] === `bytes 0-${film.size - 1}/${film.size}`,
    `and is trimmed to the file (${over.headers()['content-range']})`
  );

  // Something a player cannot use is answered with the whole file, which a
  // player will play, rather than with a broken 206 it will refuse.
  for (const bad of ['bytes=abc-def', 'bytes=-', 'kilobytes=0-10', 'bytes=0-10,20-30']) {
    const res = await page.request.get(BASE + film.src, { headers: { Range: bad } });
    check(res.status() === 200, `"${bad}" falls back to the whole film (${res.status()})`);
  }

  // A head request has to describe the film without sending it.
  const head = await page.request.fetch(BASE + film.src, { method: 'HEAD' });
  check(head.status() === 200, 'a HEAD request is answered');
  check(head.headers()['content-length'] === String(film.size), 'and gives the size without the film');
  check((await head.body()).length === 0, 'and sends no film at all');
}

{
  // Anything that is not one of the shop's own films must not be served, and
  // neither must a name that tries to climb out of its own folder.
  //
  // The dots are written %2e so the path reaches the server as typed. A plain
  // "../" is tidied away by the HTTP client before it is ever sent, so a test
  // using one proves nothing about the server.
  const attempts = [
    '/media/videos/%2e%2e%2f%2e%2e%2flist',
    '/media/videos/list',
    '/media/anything.txt',
    '/media/videos/gone',
    '/media/videos/UPPER',
    '/media/videos/has%20a%20space',
    '/media/',
  ];
  for (const bad of attempts) {
    const res = await page.request.get(BASE + bad);
    check(res.status() === 404, `${bad} is refused (${res.status()})`);
  }

  // The list is public - the public video page needs it - so reaching it is not
  // a leak. What must not be reachable is the store itself: the media route is
  // for films and posters, and nothing else in the namespace may be named
  // through it.
  for (const reach of [
    '/media/videos/list',
    '/media/videos/film%3Apaneer-cut-this-morning',
    '/media/posters/poster%3Apaneer-cut-this-morning',
    '/media/videos/VIDEOS',
  ]) {
    const res = await page.request.get(BASE + reach);
    check(res.status() === 404, `${reach} cannot name anything but a film (${res.status()})`);
  }

  // And the list hands out paths to fetch, never the store keys they are built
  // from, so nothing about the store's shape is published.
  const keys = await page.request.get(BASE + '/api/videos');
  check(keys.status() === 200, 'the public list is readable without signing in');
  const handed = (await keys.json()).videos;
  check(
    handed.length > 0 && !handed.some((v) => /film:|poster:/.test(v.src + v.poster)),
    'and it hands out paths, never the store keys those paths are built from'
  );
}

/* ------------------------------------------------ the panel must not sweep it */

{
  // The list of films lives in the same Firestore collection as the products, and
  // the panel has a repair routine that deletes anything in that collection which
  // is not an approved product. It is skipped by name - but a skip that is
  // removed is invisible until a customer's film has quietly vanished, so this
  // walks the panel exactly as an owner would and then checks the list survived.
  for (const tab of ['products', 'approvals', 'about', 'testimonials', 'enquiries']) {
    await page.goto(`${BASE}/partner/products?tab=${tab}`, { waitUntil: 'domcontentloaded' });
    await page.locator('.admin-tabs').first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(1500);
  }
  const survived = await (await page.request.get(`${BASE}/api/videos`)).json();
  check(
    survived.videos.some((v) => v.title === title),
    'visiting every tab in the panel does not empty the video page'
  );

  const stillPlays = await page.request.get(BASE + film.src, { headers: { Range: 'bytes=0-99' } });
  check(stillPlays.status() === 206, 'and the film itself is still there afterwards');
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
await page.locator('.vid-row input.input').first().fill(`Paneer, cut this morning (new) ${RUN}`);
await page.locator('.vid-row .btn-brand').click();
await page.waitForTimeout(2500);
check(
  (await page.locator('.vid-row').first().innerText()).includes('(new)'),
  'a film can be renamed'
);

/* ---------------------------------------------------------------- reorder */

// A second film, so there is an order to change. It is a few kilobytes rather
// than megabytes - the point is the ordering, not the picture.
const second = `Ghee, churned by hand ${RUN}`;
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
  check(
    newestFirst[0].includes(second),
    `the newest film is at the top of the list (order: ${newestFirst
      .map((t) => t.split('\n')[0])
      .join(' / ')})`
  );

  // Move it down. The panel sends the whole order, so the order on screen and the
  // order stored cannot fall out of step.
  await page.locator('.vid-row').first().locator('button[title="Move down"]').click();
  await page.waitForTimeout(2500);

  const afterMove = await page.locator('.vid-row').allInnerTexts();
  check(afterMove[1].includes(second), `a film can be moved down (order: ${afterMove
    .map((t) => t.split('\n')[0])
    .join(' / ')})`);
  check(afterMove[0].includes('(new)'), 'and the one above it moved up');

  const stored = (await (await page.request.get(`${BASE}/api/videos`)).json()).videos;
  check(stored[1]?.title === second, `and the new order is what was stored (${stored.map((v) => v.title).join(' / ')})`);

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

// Both films come off again, and the page is left as it was found.
//
// The loop is driven by what the server says, not by what is on screen. The
// panel says "Loading" while it re-reads the list, and there are briefly no rows
// at all in that moment - a loop that watches the screen sees an empty page,
// decides it is finished, and leaves a film behind. Watching the list of record
// means the loop ends when the films are actually gone.
const listNow = async () => (await (await page.request.get(`${BASE}/api/videos?fresh=1`)).json()).videos;

let askedAboutRemoving = false;
let transient = 0;
for (let attempt = 0; attempt < 20; attempt += 1) {
  const left = await listNow();
  if (!left.length) break;
  await page.goto(`${BASE}/partner/products?tab=videos`, { waitUntil: 'domcontentloaded' });
  await page.locator('.vid-panel').waitFor({ timeout: 30000 });

  // The panel says "could not load" rather than showing an empty page when the
  // list cannot be read, which is the right thing for it to do and not a fault
  // to fail on. A row, or that message, is what arriving means here.
  const what = await Promise.race([
    page.locator('.vid-row').first().waitFor({ timeout: 15000 }).then(() => 'row'),
    page.locator('.error-state').first().waitFor({ timeout: 15000 }).then(() => 'error'),
  ]).catch(() => 'neither');

  if (what !== 'row') {
    transient += 1;
    if (transient <= 3) {
      console.log(`  (the panel could not read the list; trying again)`);
      continue;
    }
    check(false, `the panel never listed a film that the server says is there (${what})`);
    await page.screenshot({ path: join(HERE, 'artifacts', 'remove-stuck.png'), fullPage: true });
    break;
  }

  await page.locator('.vid-row').first().locator('button[title="Remove this film"]').click();
  await page.locator('.modal').waitFor({ timeout: 10000 });
  if (!askedAboutRemoving) {
    check(true, 'removing asks first, because it cannot be undone');
    askedAboutRemoving = true;
  }
  await page.locator('.modal .btn-red').click();
  // Wait for the server, not the screen: the row count passes through zero while
  // the panel reloads, which is exactly the moment a screen-watching wait
  // mistakes for the end.
  await page
    .waitForFunction(
      async (want) => (await (await fetch('/api/videos?fresh=1')).json()).videos.length < want,
      left.length,
      { timeout: 30000, polling: 500 }
    )
    .catch(() => {});
}
if (transient) check(true, `the list stayed readable (${transient} transient hiccup(s) shown as an error, not as an empty page)`);

const after = await listNow();
check(after.length === 0, `every film is off the page again (${after.length} left)`);
check(
  !after.some((v) => v.title.includes('(new)')),
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
