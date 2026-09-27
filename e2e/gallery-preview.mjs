/**
 * The product picture viewer, on a phone and on a desktop.
 *
 * Two things this guards. The viewer is opened by a tap, because the only way to
 * see a picture bigger before was to hover at it - which a phone cannot do, so
 * a 1100px photograph was stuck in a 376px box with no way out. And it must show
 * the full stored picture, not the small one: the cache used to key on the
 * upload id alone, so the two sizes overwrote each other and the viewer opened
 * on whatever had been cached last.
 *
 *   SITE_URL=... node e2e/gallery-preview.mjs
 *
 * Needs no credentials - the product page is public. Exits non-zero on failure.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire('C:/Users/DELL/AppData/Roaming/npm/');
const { chromium, devices } = require('playwright');

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.SITE_URL || 'https://maa-saraswati-diary.web.app';
const PRODUCT = process.env.SITE_PRODUCT || 'pure-bilona-ghee';

const failures = [];
const check = (ok, what) => {
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${what}`);
  if (!ok) failures.push(what);
};

const browser = await chromium.launch();

for (const [name, options] of [
  ['phone (touch)', devices['Pixel 7']],
  ['desktop (mouse)', { viewport: { width: 1280, height: 900 } }],
]) {
  console.log(`\n${name}`);
  const ctx = await browser.newContext(options);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 120)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 120));
  });

  try {
    await page.goto(`${BASE}/products/${PRODUCT}?e2e=${Date.now()}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.locator('.pd-main img').waitFor({ timeout: 25000 });
    await page.locator('.pd-main').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);

    const thumbs = await page.locator('.pd-thumb').count();
    check(thumbs > 1, `the gallery has more than one picture (${thumbs})`);

    // Measured in this viewport, not against a desktop number: a phone page box
    // is about 360px wide, so comparing to 582 would be meaningless.
    const pageBox = await page.evaluate(() =>
      Math.round(document.querySelector('.pd-main').getBoundingClientRect().width)
    );

    // The label has to match the input the visitor actually has.
    const hint = await page.evaluate(() => ({
      touch: getComputedStyle(document.querySelector('.pd-zoom-hint-touch')).display,
      hover: getComputedStyle(document.querySelector('.pd-zoom-hint-hover')).display,
    }));
    const touch = name.startsWith('phone');
    check(
      touch ? hint.touch !== 'none' && hint.hover === 'none'
            : hint.hover !== 'none' && hint.touch === 'none',
      `the label suits the input (${touch ? 'Tap to enlarge' : 'Hover to zoom'})`
    );

    await page.locator('.pd-zoom-hit').click();
    await page.locator('.pd-lightbox').waitFor({ state: 'visible', timeout: 10000 });
    const open = await page.evaluate(() => {
      const lb = document.querySelector('.pd-lightbox');
      const img = lb.querySelector('img');
      return {
        role: lb.getAttribute('role'),
        modal: lb.getAttribute('aria-modal'),
        nat: `${img.naturalWidth}x${img.naturalHeight}`,
        shown: Math.round(img.getBoundingClientRect().width),
        count: lb.querySelector('.pd-lightbox-count')?.textContent,
        locked: getComputedStyle(document.body).overflow,
      };
    });
    check(open.role === 'dialog' && open.modal === 'true', 'opens as a labelled dialog');
    // The regression this exists for: the viewer used to serve the 420px
    // thumbnail, so the full picture was never actually reachable.
    check(
      open.nat === '1100x1100',
      `shows the full stored picture, not the thumbnail (${open.nat})`
    );
    check(open.shown > pageBox, `is larger than the page box (${open.shown} vs ${pageBox})`);
    check(open.count === '1 / 4', `says which picture it is (${open.count})`);
    check(open.locked !== 'visible', 'the page behind will not scroll');

    await page.locator('.pd-lightbox-next').click();
    await page.locator('.pd-lightbox-count', { hasText: '2 / 4' }).waitFor({ timeout: 8000 });
    check(true, 'the next arrow steps on');

    await page.locator('.pd-lightbox-prev').click();
    await page.locator('.pd-lightbox-count', { hasText: '1 / 4' }).waitFor({ timeout: 8000 });
    check(true, 'the previous arrow steps back');

    await page.keyboard.press('Escape');
    await page.locator('.pd-lightbox').waitFor({ state: 'detached', timeout: 8000 });
    check(true, 'Escape closes it');

    const active = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.pd-thumb')).findIndex((t) =>
        t.classList.contains('active')
      )
    );
    check(active === 0, `the thumbnail strip stayed in step (index ${active})`);

    check(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  } catch (err) {
    check(false, 'threw: ' + err.message.split('\n')[0]);
    try {
      mkdirSync(join(HERE, 'artifacts'), { recursive: true });
      await page.screenshot({
        path: join(HERE, 'artifacts', `gallery-${name.split(' ')[0]}-failure.png`),
        fullPage: true,
      });
    } catch {
      /* the page may be gone */
    }
  }
  await ctx.close();
}

console.log(`\n${failures.length ? `${failures.length} FAILED` : 'the viewer works on both'}`);
await browser.close();
process.exit(failures.length ? 1 : 0);
