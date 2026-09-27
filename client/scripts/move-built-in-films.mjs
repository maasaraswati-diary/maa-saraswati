/**
 * Move the films that are built into the website into the partner panel.
 *
 * The video page had two sources: the films written into the build by
 * scripts/prepare-videos.mjs, and the films the owner uploads. The panel showed
 * only the second. So the owner opened the panel, saw "nothing uploaded yet", and
 * the website beside it was playing four films - which reads as four films gone.
 *
 * Nothing was gone. They were simply somewhere the panel could not see or
 * change, and that is a worse problem than it looks: the panel is where the
 * videos are supposed to be managed, and it could not manage these.
 *
 * This puts them in the panel, which is where they belong. One list, one place
 * to rename, reorder and remove them, and the films on the page are the same
 * files rather than a copy of them.
 *
 * It drives the panel itself rather than writing to the store directly, so what
 * lands there is exactly what an upload from the panel would have produced: the
 * same poster frame taken from the same film, the same naming, the same checks.
 * A migration that took a shorter path could leave the panel holding something
 * the owner would never have been able to create themselves.
 *
 *   node client/scripts/move-built-in-films.mjs
 *
 * Runs once. Says so and does nothing if there is nothing left to move.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = resolve(fileURLToPath(new URL('.', import.meta.url)));
const CLIENT = resolve(HERE, '..');
const ROOT = resolve(CLIENT, '..');
const SITE = process.env.SITE_URL || 'https://maa-saraswati-diary.pages.dev';
const EMAIL = process.env.SITE_EMAIL;
const PASSWORD = process.env.SITE_PASSWORD;

const mb = (n) => (n / 1048576).toFixed(2) + ' MB';
const say = (line = '') => console.log(line);

/* ---------------------------------------------------------- what is to move */

if (!EMAIL || !PASSWORD) {
  say('Set SITE_EMAIL and SITE_PASSWORD to the owner sign-in, then run this again.');
  process.exit(1);
}

const manifestPath = join(CLIENT, 'src', 'videoAds.js');
const manifest = readFileSync(manifestPath, 'utf8');
const films = JSON.parse(manifest.slice(manifest.indexOf('['), manifest.lastIndexOf(']') + 1));

if (!films.length) {
  say('No films are built into the website, so there is nothing to move.');
  process.exit(0);
}

say('');
say('  Films built into the website:');
for (const film of films) {
  const file = join(CLIENT, 'public', String(film.src).replace(/^\//, ''));
  const size = existsSync(file) ? mb(statSync(file).size) : 'FILE MISSING';
  say(`    ${String(film.title).padEnd(22)} ${size.padStart(10)}   ${film.slug}`);
}
say('');

/* ------------------------------------------------------------------ the move */

const { chromium } = createRequire('C:/Users/DELL/AppData/Roaming/npm/')('playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

try {
  say('Signing in...');
  await page.goto(`${SITE}/partner`, { waitUntil: 'domcontentloaded' });
  await page.locator('#pemail').fill(EMAIL);
  await page.locator('#ppass').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL(/\/partner\/products/, { timeout: 45000 });

  await page.goto(`${SITE}/partner/products?tab=videos`, { waitUntil: 'domcontentloaded' });
  await page.locator('.vid-panel').waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);

  const already = await page.locator('.vid-row').count();
  if (already) {
    say(`The panel already has ${already} film(s), so this has been done before.`);
    say('Nothing has been changed.');
  } else {
    // Uploaded last-registered-first, because the panel puts a new film at the
    // top. Working backwards through the list therefore leaves it in the order
    // it was in, and the films on the page do not jump about during the move.
    for (const film of [...films].reverse()) {
      const file = join(CLIENT, 'public', String(film.src).replace(/^\//, ''));
      if (!existsSync(file)) {
        say(`  SKIPPED "${film.title}" - the file is not there (${film.src})`);
        continue;
      }
      say(`  Moving "${film.title}" (${mb(statSync(file).size)})...`);
      await page.setInputFiles('#video-file', file);
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
  }

  await page.goto(`${SITE}/partner/products?tab=videos`, { waitUntil: 'domcontentloaded' });
  await page.locator('.vid-row').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);
  const listed = await page.locator('.vid-row').allInnerTexts();

  say('');
  say('  On the panel now:');
  for (const text of listed) say(`    ${text.split('\n')[0]}`);

  const shots = join(ROOT, 'e2e', 'artifacts');
  if (existsSync(shots)) {
    await page.screenshot({ path: join(shots, 'films-moved.png'), fullPage: true });
  }
} catch (err) {
  say('');
  say('  Could not finish: ' + String(err?.message || err).split('\n')[0]);
  say('  Nothing was removed. Any film that did move is on the panel already.');
  process.exitCode = 1;
} finally {
  await browser.close();
}
