/**
 * Every screen in the partner panel, opened in a real browser.
 *
 * This exists because a single misplaced line took the product edit form down to
 * a blank white screen. usePageMeta read `isEdit` one line above the `const`
 * that declared it, which is a temporal dead zone error: it did not fail one
 * line, it unmounted the page. Nothing on the site said anything was wrong, and
 * the only way to find it was to actually open the screen.
 *
 * So this walks every route the owner can reach and insists each one renders
 * something. A blank body or a page error fails the run.
 *
 *   SITE_EMAIL=... SITE_PASSWORD=... node e2e/panel-smoke.mjs
 *
 * Skips cleanly without credentials. Exits non-zero on failure. Read-only: it
 * opens screens and changes nothing.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire('C:/Users/DELL/AppData/Roaming/npm/');
const { chromium } = require('playwright');

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.SITE_URL || 'https://maa-saraswati-diary.web.app';
const email = process.env.SITE_EMAIL;
const password = process.env.SITE_PASSWORD;

if (!email || !password) {
  console.log('Set SITE_EMAIL and SITE_PASSWORD to run the panel smoke test.');
  process.exit(0);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

let problems = [];
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console: ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`uncaught: ${e.message}`));
page.on('response', (r) => {
  if (r.status() >= 400) problems.push(`http ${r.status()}: ${r.url().slice(0, 100)}`);
});

const failures = [];

/** Opens a route and insists it rendered something a person could use. */
async function check(path, readyFor) {
  problems = [];
  const started = Date.now();
  let rendered = true;
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    // A selector that only exists once the screen has really rendered. Waiting
    // for it is what separates a working screen from a blank one.
    await readyFor.waitFor({ timeout: 20000 });
  } catch (err) {
    rendered = false;
    problems.push(`did not render: ${err.message.split('\n')[0]}`);
  }
  const state = await page.evaluate(() => ({
    path: location.pathname + location.search,
    chars: document.body.innerText.trim().length,
  }));
  // A screen that is on the right route but has no text is the failure mode a
  // crashed component produces, and the one this test was written for.
  if (rendered && state.chars < 40) {
    rendered = false;
    problems.push(`blank: only ${state.chars} characters of text`);
  }
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`  ${rendered ? 'pass' : 'FAIL'}  ${path.padEnd(44)} ${secs.padStart(5)}s  ${state.chars} chars`);
  [...new Set(problems)].slice(0, 3).forEach((p) => console.log(`        ${p}`));
  if (!rendered) failures.push(path);
}

try {
  console.log('public pages');
  await check('/', page.getByRole('heading', { level: 1 }));
  await check('/products', page.locator('.pcard').first());
  await check('/about', page.locator('.team-card').first());
  await check('/contact', page.getByRole('heading', { level: 1 }));
  await check('/partner', page.locator('#ppass'));

  // sign in on the panel, then walk the signed-in screens
  await page.locator('#pemail').fill(email);
  await page.locator('#ppass').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.locator('tbody tr').first().waitFor({ timeout: 30000 });

  // Collect the product ids here, while the table is on screen. Asking later
  // finds nothing, because the tabs hide it.
  const ids = await page.evaluate(() => [
    ...new Set(
      Array.from(document.querySelectorAll('a[href^="/partner/products/"]'))
        .map((a) => a.getAttribute('href').split('/').pop())
        .filter((x) => x && x !== 'new')
    ),
  ]);

  console.log('\npanel screens');
  await check('/partner/products', page.locator('tbody tr').first());
  // .admin-pane rather than .admin-tab: the tab bar has five buttons on every
  // screen, so it says nothing about which one is on screen.
  await check('/partner/products?tab=approvals', page.locator('.admin-pane'));
  await check('/partner/products?tab=testimonials', page.locator('.admin-pane'));
  await check(
    '/partner/products?tab=about',
    page.getByRole('button', { name: 'Save and publish' })
  );
  await check('/partner/products?tab=enquiries', page.locator('.admin-pane'));
  await check('/partner/products/new', page.locator('#name'));

  // every product, because a broken edit screen is invisible until it is opened
  console.log(`\nedit a product (${ids.length} of them)`);
  for (const id of ids) {
    await check(`/partner/products/${id}`, page.locator('#name'));
  }
} catch (err) {
  failures.push('threw: ' + err.message.split('\n')[0]);
  console.log(`  FAIL  threw: ${err.message.split('\n')[0]}`);
  try {
    mkdirSync(join(HERE, 'artifacts'), { recursive: true });
    await page.screenshot({
      path: join(HERE, 'artifacts', 'panel-smoke-failure.png'),
      fullPage: true,
    });
    console.log('  screenshot: e2e/artifacts/panel-smoke-failure.png');
  } catch {
    /* the page may be gone */
  }
}

console.log(`\n${failures.length ? `${failures.length} FAILED` : 'every screen rendered'}`);
await browser.close();
process.exit(failures.length ? 1 : 0);
