/**
 * The About page editor, checked in a real browser.
 *
 * This exists because every picture slot in that tab was broken at once and
 * nothing said so. saveProductImage was called but never imported, the handler
 * rethrew into a void, and the symptom was five slots that silently did
 * nothing. A test that only walked the page and read its text would have passed.
 *
 *   SITE_EMAIL=... SITE_PASSWORD=... node e2e/about-upload.mjs
 *
 * Skips cleanly when the credentials are not set, and exits non-zero on failure
 * so it can be wired into a deploy check. The site is left exactly as it found
 * itself.
 */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire('C:/Users/DELL/AppData/Roaming/npm/');
const { chromium } = require('playwright');

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.SITE_URL || 'https://maa-saraswati-diary.web.app';
const email = process.env.SITE_EMAIL;
const password = process.env.SITE_PASSWORD;

if (!email || !password) {
  console.log('Set SITE_EMAIL and SITE_PASSWORD to run the About editor check.');
  process.exit(0);
}

// Deliberately portrait: the stored copy has to come back square, which is what
// proves the padding ran rather than the photo being cropped.
const PHOTO = readFileSync(join(HERE, 'fixtures', 'check.jpg'));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// Attached before the first navigation: errors thrown during load are the
// interesting ones, and a listener added afterwards misses them.
const problems = [];
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console: ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`uncaught: ${e.message}`));
page.on('response', (r) => {
  if (r.status() >= 400) problems.push(`http ${r.status()}: ${r.url().slice(0, 100)}`);
});

const fail = [];
const check = (ok, what) => {
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${what}`);
  if (!ok) fail.push(what);
};

try {
  await page.goto(`${BASE}/partner/products?tab=about`, { waitUntil: 'domcontentloaded' });

  // The file inputs are hidden behind styled labels, so wait for one of the two
  // real outcomes rather than assuming which page we landed on.
  await page
    .locator('input[type=password], .admin-tab')
    .first()
    .waitFor({ timeout: 20000 });

  if (await page.locator('input[type=password]').count()) {
    // By id, not by label: "Password" also matches the show/hide toggle, and
    // getByLabel refuses to choose between two matches.
    await page.locator('#pemail').fill(email);
    await page.locator('#ppass').fill(password);
    await page.getByRole('button', { name: 'Sign In' }).click();
  }
  await page.locator('.admin-tab').first().waitFor({ timeout: 30000 });
  check(true, 'signed in and the panel loaded');

  await page.getByRole('button', { name: 'About Page' }).click();
  const slots = page.locator('input[type=file]');
  await slots.first().waitFor({ state: 'attached' });
  check((await slots.count()) === 5, 'all five picture slots are present');

  // Founder is slot two: story, then one per team member, then the plant.
  await slots.nth(1).setInputFiles({
    name: 'check.jpg',
    mimeType: 'image/jpeg',
    buffer: PHOTO,
  });
  // A Remove button appears only once the slot holds a picture, so this waits
  // for the upload to have finished rather than for a fixed time.
  await page
    .locator('.field button', { hasText: 'Remove' })
    .first()
    .waitFor({ timeout: 30000 });
  check(true, 'a chosen photo is stored on the founder slot');

  await page.getByRole('button', { name: 'Save and publish' }).click();
  await page.getByText('About page updated').waitFor({ timeout: 30000 });
  check(true, 'the panel saved without being refused');

  // A separate page, so nothing is served out of this one's memory cache.
  const pub = await browser.newPage();
  await pub.goto(`${BASE}/about?e2e=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await pub.getByRole('heading', { level: 1 }).waitFor();
  await pub.locator('.team-card').first().scrollIntoViewIfNeeded();
  await pub
    .locator('.team-card .team-avatar-photo img')
    .first()
    .waitFor({ state: 'attached', timeout: 20000 });
  // Attached is not decoded. The picture arrives as a data URL read out of
  // Firestore, so naturalWidth is still 0 for a moment after the element exists
  // - and reading it then is a race that fails on a fast connection less often
  // than on a slow one. decode() resolves when there is genuinely something to
  // measure.
  await pub
    .locator('.team-card .team-avatar-photo img')
    .first()
    .evaluate((img) => img.decode().catch(() => {}));

  const shown = await pub.evaluate(() => {
    const img = document.querySelector('.team-card .team-avatar-photo img');
    return {
      name: document.querySelector('.team-card .team-name')?.textContent?.trim(),
      loaded: !!img && img.naturalWidth > 0,
      square: !!img && img.naturalWidth === img.naturalHeight,
    };
  });
  check(shown.loaded, `the founder photo renders on the public page (${shown.name})`);
  check(shown.square, 'the stored picture is square, so nothing is cropped');
  await pub.close();

  // Leave the site as we found it.
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Restore the original text' }).click();
  await page.getByRole('button', { name: 'Save and publish' }).click();
  await page.getByText('About page updated').waitFor({ timeout: 30000 });

  const pub2 = await browser.newPage();
  await pub2.goto(`${BASE}/about?e2e-clean=${Date.now()}`, {
    waitUntil: 'domcontentloaded',
  });
  await pub2.getByRole('heading', { level: 1 }).waitFor();
  const initials = await pub2.evaluate(
    () => document.querySelector('.team-avatar')?.textContent?.trim()
  );
  check(!!initials, `restored: the team card is back to initials (${initials})`);
  await pub2.close();
} catch (err) {
  fail.push(`threw: ${err.message.split('\n')[0]}`);
  console.log(`  FAIL  threw: ${err.message.split('\n')[0]}`);
  try {
    mkdirSync(join(HERE, 'artifacts'), { recursive: true });
    await page.screenshot({
      path: join(HERE, 'artifacts', 'about-upload-failure.png'),
      fullPage: true,
    });
    console.log('  screenshot: e2e/artifacts/about-upload-failure.png');
  } catch {
    /* the page may be gone */
  }
}

if (problems.length) {
  console.log('\nbrowser reported:');
  [...new Set(problems)].slice(0, 10).forEach((p) => console.log(`  ${p}`));
}

console.log(`\n${fail.length ? `${fail.length} FAILED` : 'all checks passed'}`);
await browser.close();
process.exit(fail.length ? 1 : 0);
