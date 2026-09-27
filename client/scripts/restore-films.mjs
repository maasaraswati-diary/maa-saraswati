/**
 * Put films back that are on disk but no longer on the page.
 *
 * The partner panel's Videos tab deletes what it is told to delete, and a test
 * run that empties the page is a test run that can take the shop's own films with
 * it. The files are still in client/public/videos, so nothing is lost - but a
 * film that is not listed plays nowhere, and the owner has to know.
 *
 * This finds films that exist as files but are not on the page, and uploads the
 * ones asked for. It never touches a film that is already listed.
 *
 *   node client/scripts/restore-films.mjs ghee milk
 *   node client/scripts/restore-films.mjs --list
 *   node client/scripts/restore-films.mjs --all
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = resolve(fileURLToPath(new URL('.', import.meta.url)));
const CLIENT = resolve(HERE, '..');
const SITE = process.env.SITE_URL || 'https://maa-saraswati-diary.pages.dev';
const EMAIL = process.env.SITE_EMAIL;
const PASSWORD = process.env.SITE_PASSWORD;

const say = (line = '') => console.log(line);
const mb = (n) => (n / 1048576).toFixed(2) + ' MB';

if (!EMAIL || !PASSWORD) {
  say('Set SITE_EMAIL and SITE_PASSWORD to the owner sign-in, then run this again.');
  process.exit(1);
}

/* ------------------------------------------------ what is on disk, and what is not */

const manifestPath = join(CLIENT, 'src', 'videoAds.js');
const manifest = readFileSync(manifestPath, 'utf8');
const films = JSON.parse(manifest.slice(manifest.indexOf('['), manifest.lastIndexOf(']') + 1));

const onDisk = films
  .map((film) => {
    const file = join(CLIENT, 'public', String(film.src).replace(/^\//, ''));
    return { ...film, file, exists: existsSync(file) };
  })
  .filter((f) => f.exists);

const wanted = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const all = process.argv.includes('--all');
const justList = process.argv.includes('--list');

const { chromium } = createRequire('C:/Users/DELL/AppData/Roaming/npm/')('playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

try {
  await page.goto(`${SITE}/partner`, { waitUntil: 'domcontentloaded' });
  await page.locator('#pemail').fill(EMAIL);
  await page.locator('#ppass').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL(/\/partner\/products/, { timeout: 45000 });

  await page.goto(`${SITE}/partner/products?tab=videos`, { waitUntil: 'domcontentloaded' });
  await page.locator('.vid-panel').waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);
  const listed = (await page.locator('.vid-row').allInnerTexts()).map((t) => t.split('\n')[0].trim());

  const missing = onDisk.filter((f) => !listed.includes(f.title));

  say('');
  say('  On the page:');
  listed.forEach((t) => say(`    ${t}`));
  say('');
  say('  On disk but not on the page:');
  if (!missing.length) {
    say('    (none - everything on disk is on the page)');
  } else {
    missing.forEach((f) => say(`    ${f.title.padEnd(22)} ${mb(statSync(f.file).size).padStart(9)}   ${f.slug}`));
  }
  say('');

  if (justList) {
    /* nothing to do */
  } else {
    const toPut = all
      ? missing
      : onDisk.filter((f) => wanted.includes(f.slug) && !listed.includes(f.title));

    if (!toPut.length) {
      say('  Nothing to put back.');
    } else {
      // Uploaded last-first, because a new film goes to the top. Working
      // backwards through the wanted order leaves them in the order given.
      for (const film of [...toPut].reverse()) {
        say(`  Putting back "${film.title}" (${mb(statSync(film.file).size)})...`);
        await page.setInputFiles('#video-file', film.file);
        await page.waitForTimeout(400);
        await page.fill('#video-title', film.title);
        await page.fill('#video-note', film.note || '');
        const before = await page.locator('.vid-row').count();
        await page.locator('.vid-panel .card.form-card .btn-brand').click();
        await page.waitForFunction((n) => document.querySelectorAll('.vid-row').length > n, before, {
          timeout: 180000,
        });
        say('    done');
      }
      await page.goto(`${SITE}/partner/products?tab=videos`, { waitUntil: 'domcontentloaded' });
      await page.locator('.vid-row').first().waitFor({ timeout: 30000 });
      await page.waitForTimeout(2500);
      say('');
      say('  On the page now:');
      for (const t of (await page.locator('.vid-row').allInnerTexts()).map((x) => x.split('\n')[0].trim())) {
        say(`    ${t}`);
      }
    }
  }
} catch (err) {
  say('');
  say('  Could not finish: ' + String(err?.message || err).split('\n')[0]);
  process.exitCode = 1;
} finally {
  await browser.close();
}
