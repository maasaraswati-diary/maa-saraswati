/**
 * The website page and the panel must never disagree.
 *
 * This exists because they did, four separate times, and each time it was
 * reported the same way: a film was removed in the panel, the panel showed one
 * number and the website another. The cause was never the same twice - a cached
 * list, a store that had not caught up, a tab that was left open - and fixing
 * each one in turn left the owner to keep finding the next.
 *
 * So this tests the thing that was actually wrong, rather than any one cause of
 * it: a copy of the website that is open on one tab while the panel is worked in
 * another. Every change the owner can make is made, and the already-open page is
 * checked after each, without being reloaded. A fresh load is checked too,
 * because that is what a visitor gets.
 *
 * Only films this run adds are touched. The shop's own films are counted before
 * and after and must be identical.
 *
 *   SITE_EMAIL=... SITE_PASSWORD=... node e2e/films-agree.mjs
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire('C:/Users/DELL/AppData/Roaming/npm/');
const { chromium } = require('playwright');

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.SITE_URL || 'https://maa-saraswati-diary.pages.dev';
const email = process.env.SITE_EMAIL;
const password = process.env.SITE_PASSWORD;

if (!email || !password) {
  console.log('No SITE_EMAIL / SITE_PASSWORD - skipping.');
  process.exit(0);
}

const RUN = Date.now().toString(36).slice(-4);
const NAME = `Agreement check (test ${RUN})`;

let n = 0;
const fails = [];
const check = (ok, what) => {
  n += 1;
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${what}`);
  if (!ok) fails.push(what);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

/* the website, open and left alone - this is the page that must keep up */
const site = await ctx.newPage();
await site.goto(`${BASE}/videos?a=${Date.now()}`, { waitUntil: 'domcontentloaded' });
await site.locator('.vcard').first().waitFor({ timeout: 30000 });
await site.waitForTimeout(2500);

const siteTitles = async () => (await site.locator('.vcard-title').allInnerTexts()).map((t) => t.trim());
const apiTitles = async () => {
  const r = await site.request.get(`${BASE}/api/videos?x=${Date.now()}`);
  return (await r.json()).videos.map((v) => v.title);
};

/** Wait for the open page to show `title`, and say how long it took. */
const follows = async (title, what) => {
  const started = Date.now();
  let seen = false;
  while (Date.now() - started < 40000) {
    if ((await siteTitles()).includes(title)) {
      seen = true;
      break;
    }
    await site.waitForTimeout(250);
  }
  const took = Math.round((Date.now() - started) / 100) / 10;
  check(seen, `${what} - the open page followed within ${took}s`);
  return took;
};

const before = await apiTitles();
check(true, `the page starts showing ${before.length} film(s): ${before.join(' | ')}`);

/* the panel, in another tab */
const panel = await ctx.newPage();
await panel.goto(`${BASE}/partner`, { waitUntil: 'domcontentloaded' });
await panel.locator('#pemail').fill(email);
await panel.locator('#ppass').fill(password);
await panel.getByRole('button', { name: 'Sign In' }).click();
await panel.waitForURL(/\/partner\/products/, { timeout: 45000 });
await panel.goto(`${BASE}/partner/products?tab=videos`, { waitUntil: 'domcontentloaded' });
await panel.locator('.vid-panel').waitFor({ timeout: 30000 });
await panel.waitForTimeout(2500);

const panelRows = async () => (await panel.locator('.vid-row').allInnerTexts()).map((t) => t.split('\n')[0].trim());
const rowOf = async (title) => (await panelRows()).indexOf(title);

/* ------------------------------------------------------------------- add */

await panel.setInputFiles('#video-file', join(HERE, '..', 'video ads', 'DAHI MOTU PATLU (Edited).mp4'));
await panel.waitForTimeout(500);
await panel.fill('#video-title', NAME);
const rowsBefore = await panel.locator('.vid-row').count();
await panel.click('.vid-panel .card.form-card .btn-brand');
await panel.waitForFunction((k) => document.querySelectorAll('.vid-row').length > k, rowsBefore, {
  timeout: 120000,
});
check((await rowOf(NAME)) >= 0, 'the panel lists it at once');
check((await panel.locator('.vid-missing').count()) === 0, 'with no warning about the file being missing');
await follows(NAME, 'a film added');

/* ---------------------------------------------------------------- rename */

{
  const at = await rowOf(NAME);
  await panel.locator('.vid-row').nth(at).locator('button[title="Change the title"]').click();
  await panel.locator('.vid-row input.input').first().fill(`${NAME} renamed`);
  await panel.locator('.vid-row .btn-brand').click();
  await panel.waitForTimeout(1500);
  check((await rowOf(`${NAME} renamed`)) >= 0, 'the panel shows the new title');
  await follows(`${NAME} renamed`, 'a film renamed');
}

/* ---------------------------------------------------------------- order */

{
  const at = await rowOf(`${NAME} renamed`);
  await panel.locator('.vid-row').nth(at).locator('button[title="Move down"]').click();
  await panel.waitForTimeout(1500);
  const now = await siteTitles();
  const wanted = (await apiTitles());
  check(
    JSON.stringify(now) === JSON.stringify(wanted),
    `the order on the page is the order on the server (${now.join(' | ')})`
  );
}

/* ---------------------------------------------------------------- remove */

{
  const at = await rowOf(`${NAME} renamed`);
  await panel.locator('.vid-row').nth(at).locator('button[title="Remove this film"]').click();
  await panel.locator('.modal').waitFor({ timeout: 10000 });
  await panel.locator('.modal .btn-red').click();
  await panel.waitForTimeout(2000);
  check((await rowOf(`${NAME} renamed`)) < 0, 'the panel drops it at once');

  const started = Date.now();
  let gone = false;
  while (Date.now() - started < 40000) {
    if (!(await siteTitles()).some((t) => t.includes(RUN))) {
      gone = true;
      break;
    }
    await site.waitForTimeout(250);
  }
  const took = Math.round((Date.now() - started) / 100) / 10;
  check(gone, `a film removed - the open page followed within ${took}s`);
}

/* ------------------------------------------------- and a fresh load, twice */

{
  const other = await ctx.newPage();
  await other.goto(`${BASE}/videos?b=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await other.locator('.vcard').first().waitFor({ timeout: 30000 });
  await other.waitForTimeout(2000);
  const shown = (await other.locator('.vcard-title').allInnerTexts()).map((t) => t.trim());
  const listed = await apiTitles();
  check(
    JSON.stringify(shown) === JSON.stringify(listed),
    `a page opened fresh shows exactly what the server holds (${shown.join(' | ')})`
  );
  await other.close();
}

await site.bringToFront();
await site.waitForTimeout(1500);
check(
  JSON.stringify(await siteTitles()) === JSON.stringify(await apiTitles()),
  'and the page that was open the whole time agrees too'
);

/* ------------------------------------------------------------- untouched */

const after = await apiTitles();
const shopBefore = before.filter((t) => !t.includes('(test '));
const shopAfter = after.filter((t) => !t.includes('(test '));
check(
  JSON.stringify(shopBefore) === JSON.stringify(shopAfter),
  `the shop's own films are untouched (${shopAfter.join(' | ')})`
);
check(
  !after.some((t) => t.includes('(test ')),
  'and nothing from this run was left behind'
);

console.log(`\n${n - fails.length}/${n} passed`);
if (fails.length) console.log('failed: ' + fails.join(' | '));
await browser.close();
process.exit(fails.length ? 1 : 0);
