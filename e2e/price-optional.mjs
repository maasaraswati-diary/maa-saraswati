/**
 * A product's price is optional.
 *
 * The owner asked to be able to leave the price off in the panel, which sounds
 * like a one-line change to a form and is not. Removing the "required" marker
 * lets an empty string reach the database, and an empty string read back through
 * `Number(x) || 0` is a zero - so the product goes live as "free", sorts to the
 * top of the cheapest-first list, and if it also happens to carry an MRP, the
 * card claims to be saving ₹210 on something that has no price to save against.
 *
 * So this checks the whole chain rather than the form: the panel writing null,
 * the storefront reading null, and every place a price can appear. It runs
 * against a local build with the network to Firestore cut, which means it can
 * never touch the owner's real catalogue - the one thing a test that logs in and
 * saves a product must never be allowed to do while the owner is in the panel.
 *
 *   node e2e/price-optional.mjs
 */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { toPrice, hasPrice, formatPrice, compareByPrice, PRICE_ON_REQUEST } from '../client/src/api.js';

const require = createRequire('C:/Users/DELL/AppData/Roaming/npm/');
const { chromium } = require('playwright');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = join(ROOT, 'client', 'dist');
const SEED = join(ROOT, 'server', 'data', 'products.json');
const PORT = 8793;
const BASE = `http://127.0.0.1:${PORT}`;

let pass = 0;
const fails = [];
const ok = (cond, what) => {
  if (cond) { pass += 1; console.log(`  pass  ${what}`); }
  else { fails.push(what); console.log(`  FAIL  ${what}`); }
};
const eq = (got, want, what) =>
  ok(got === want, `${what}  (got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)})`);

/* ------------------------------------------------------------------ 1. units */

console.log('\nA product with no price is not a product priced at zero');

eq(toPrice(null), null, 'toPrice(null) is null');
eq(toPrice(undefined), null, 'toPrice(undefined) is null');
eq(toPrice(''), null, "toPrice('') is null");
eq(toPrice('  '), null, "toPrice('  ') is null");
eq(toPrice(0), null, 'toPrice(0) is null - a zero rupee price is a typo, not a price');
eq(toPrice('0'), null, "toPrice('0') is null");
eq(toPrice('abc'), null, "toPrice('abc') is null, not NaN");
eq(toPrice(190), 190, 'toPrice(190) is 190');
eq(toPrice('190'), 190, "toPrice('190') is 190");
eq(toPrice(190.5), 190.5, 'toPrice keeps a decimal price');

eq(formatPrice(null), '', 'formatPrice(null) is blank, never ₹0');
eq(formatPrice(undefined), '', 'formatPrice(undefined) is blank');
eq(formatPrice(NaN), '', 'formatPrice(NaN) is blank');
// Zero still prints, because the panel's listed value is honestly zero when
// nothing in the catalogue is priced.
eq(formatPrice(0), '₹0', 'formatPrice(0) is still ₹0 - it also formats sums');
eq(formatPrice(190), '₹190', 'formatPrice(190) is ₹190');
eq(formatPrice('1250'), '₹1,250', 'formatPrice still groups thousands');

ok(!hasPrice({ price: null }), 'hasPrice is false for an unpriced product');
ok(!hasPrice({}), 'hasPrice is false when the field is missing entirely');
ok(!hasPrice(undefined), 'hasPrice is false for no product at all');
ok(hasPrice({ price: 190 }), 'hasPrice is true for a priced product');
// The trap itself. `null` coerces to 0 in a relational comparison, so an MRP
// beside a missing price reads as "210 > 0" - the card would claim a saving on
// something with no price to save against. Every price in the UI is behind
// hasPrice() because this is true.
ok(210 > null, '210 > null is TRUE in JavaScript - that is the bug this guards');

/* ------------------------------------------------------------------- 2. sort */

console.log('\nUnpriced products sort last, not first');

const cheap = { id: 'a', price: 90 };
const dear = { id: 'b', price: 190 };
const ask = { id: 'c', price: null };
const ask2 = { id: 'd', price: undefined };

const asc = [dear, ask, cheap, ask2].sort((a, b) => compareByPrice(a, b, 1)).map((p) => p.id);
eq(asc.join(','), 'a,b,c,d', 'cheapest first: 90, 190, then the two unpriced at the end');

const desc = [cheap, ask2, dear, ask].sort((a, b) => compareByPrice(a, b, -1)).map((p) => p.id);
eq(desc.join(','), 'b,a,d,c', 'dearest first: 190, 90, then the two unpriced at the end');

// The plain comparator, which is what the code used to do.
const naive = [dear, ask, cheap].sort((a, b) => a.price - b.price).map((p) => p.id);
eq(naive.join(','), 'c,a,b', 'the old comparator really did put the unpriced one first');

/* ------------------------------------------------- 3. the real pages, rendered */

const TEST_PRODUCTS = [
  {
    // No price at all. JSON null, which is what the panel writes when the field
    // is left blank, and what toProduct turns a missing or zero field into.
    // shortName is set to the same string because a card's heading is
    // `shortName || name`, and the tests find these products by that heading.
    id: 'zztest-noprice', slug: 'zztest-noprice', name: 'ZZ Test No Price',
    shortName: 'ZZ Test No Price', category: 'Milk',
    tagline: 'No price on purpose', taglineEnglish: 'No price on purpose',
    price: null, mrp: null, unit: 'pack', packSize: '500 g',
    fat: null, veg: true, inStock: true, featured: false,
    rating: 4.5, reviewCount: 0, soldLabel: '',
    shortDescription: 'Checking an absent price.',
    description: ['First line.', 'Second line.'],
    images: [], highlights: [], features: [], nutrition: [], usage: [], faqs: [],
    createdAt: '2026-01-02T00:00:00.000Z',
  },
  {
    // The dangerous shape: an MRP left behind with no price. JavaScript reads
    // 210 > null as 210 > 0, so an unguarded card advertises a saving.
    id: 'zztest-mrp-only', slug: 'zztest-mrp-only', name: 'ZZ Test MRP Only',
    shortName: 'ZZ Test MRP Only', category: 'Milk',
    tagline: 'An MRP and nothing else', taglineEnglish: 'An MRP and nothing else',
    price: null, mrp: 210, unit: 'pack', packSize: '500 g',
    fat: null, veg: true, inStock: true, featured: false,
    rating: 4.5, reviewCount: 0, soldLabel: '',
    shortDescription: 'Checking an MRP with no price.',
    description: ['First line.', 'Second line.'],
    images: [], highlights: [], features: [], nutrition: [], usage: [], faqs: [],
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

/** Serves the built site, rewriting /x to /x.html so deep links work. */
function serveDist() {
  return createServer(async (req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let file = join(DIST, url.replace(/^\/+/, ''));
    if (existsSync(file) && !extname(file)) file += '.html';
    if (!existsSync(file) || !file.startsWith(DIST)) file = join(DIST, 'index.html');
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404); res.end('no');
    }
  });
}

/**
 * Builds the client: the prebuild snapshot step, then vite.
 *
 * Both run through node directly rather than through `npm run build`. npm is a
 * .cmd beside the running node, and its path has a space in it, which cmd
 * quotes in ways that do not survive being passed as an argv element - so the
 * build failed before it started, twice, for a reason that had nothing to do with
 * what was being tested.
 *
 * STATIC_ONLY is what makes this whole test possible. The build then has no
 * Firebase in it at all: the catalogue comes from the snapshot the prebuild step
 * just wrote, and no request leaves the machine. Stubbing the Firestore REST
 * endpoints does not work, because the SDK sends its reads over a long-lived
 * connection that retries rather than failing, so the page sat empty instead of
 * falling back - and answering that connection instead means speaking
 * gRPC-Web to get a real answer.
 */
function build() {
  const client = join(ROOT, 'client');
  execFileSync(process.execPath, [join(client, 'scripts', 'sync-catalogue.mjs')], {
    cwd: client, stdio: 'pipe',
  });
  execFileSync(
    process.execPath,
    [join(client, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'],
    { cwd: client, stdio: 'pipe', env: { ...process.env, VITE_STATIC_ONLY: '1' } }
  );
}

/** Gives the two test products a real picture, borrowed from a real product. */
function withTestProducts(seed) {
  const withImage = seed.find((p) => p.images && p.images.length);
  for (const t of TEST_PRODUCTS) if (withImage) t.images = withImage.images;
  return [...seed, ...TEST_PRODUCTS];
}

let seedBackup = null;
let server = null;
let browser = null;

try {
  seedBackup = await readFile(SEED, 'utf8');
  await writeFile(SEED, JSON.stringify(withTestProducts(JSON.parse(seedBackup)), null, 2), 'utf8');

  console.log('\nBuilding with two unpriced products in the catalogue');
  build();

  server = serveDist();
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

  /* The build under test has no Firebase in it, so there is nothing to intercept
     and nothing to reach the owner's project. Any request to a Firebase or
     Firestore endpoint is therefore a bug in that build, so it is recorded and
     failed rather than allowed to quietly answer from the real shop. Web fonts
     are left alone: they are not the shop's data and the site needs them. */
  const reachedOut = [];
  await page.route(/firebaseio|firebaseapp|firebase\.google|firebaserpc|firestore\.googleapis|identitytoolkit|google-analytics/,
    (route) => {
      reachedOut.push(route.request().url().slice(0, 100));
      return route.abort('failed');
    });

  /**
   * Loads a page and waits for the thing it is going to be read from.
   *
   * It has to wait for the real content and not for "any of these four": the
   * list renders an empty state before the catalogue arrives, so a selector that
   * accepted `.empty-state` returned on the empty page and reported a product
   * missing that was merely late. A page that never grows its target selector is
   * still read - that is what the empty-state assertions are for.
   */
  const open = async (url, readyFor) => {
    const res = await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' });
    if (res && res.status() >= 400) return `HTTP ${res.status()}`;
    await page.waitForSelector(readyFor, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(400);
    return page.locator('body').innerText();
  };
  const openProduct = (slug) => open(`/products/${slug}`, '.pd-pricebox');

  /* Read one element rather than the whole page. A product page ends with a
     "you might also like" grid of other products, and their prices and discount
     badges are not what is under test - asserting on the body text meant the
     paneer's ₹210, from a card three sections down, failed the MRP check. */
  const priceBox = async () => {
    const el = page.locator('.pd-pricebox');
    return (await el.count()) ? (await el.innerText()).trim() : null;
  };
  const discountBadges = async () =>
    page.locator('.pd-main-badges .badge-red').count();

  console.log('\nThe products page');
  const list = await open('/products', '.pcard, .empty-state');
  // Read the cards by their heading rather than by counting them, and say what
  // was actually there when a name is missing - a count of ten is not evidence
  // that the two unpriced products are among the ten.
  const cardNames = await page.evaluate(() =>
    [...document.querySelectorAll('.pcard')].map((c) => {
      const h = c.querySelector('h2, h3');
      return h ? h.textContent.trim() : '(no heading)';
    })
  );
  ok(cardNames.includes('ZZ Test No Price'),
    `the unpriced product is on the page (saw: ${cardNames.join(' | ')})`);
  ok(list.includes(PRICE_ON_REQUEST), 'it says "Price on request"');
  ok(!list.includes('₹0'), 'nothing on the page reads as ₹0');
  ok(list.includes('₹190'), 'the priced products still show their price');

  const cardAsk = await page.evaluate(() => {
    const card = [...document.querySelectorAll('.pcard')]
      .find((c) => c.textContent.includes('ZZ Test No Price'));
    return card ? card.querySelector('.pcard-price')?.innerText.trim() : null;
  });
  eq(cardAsk, PRICE_ON_REQUEST, 'the card shows exactly the on-request line and nothing else');

  // The card that has an MRP and no price must not advertise a discount.
  const cardMrp = await page.evaluate(() => {
    const card = [...document.querySelectorAll('.pcard')]
      .find((c) => c.textContent.includes('ZZ Test MRP Only'));
    if (!card) return { price: 'no such card', badge: 'no such card' };
    return {
      price: card.querySelector('.pcard-price')?.innerText.trim(),
      badge: card.querySelector('.badge-red')?.innerText.trim() || null,
    };
  });
  eq(cardMrp?.price, PRICE_ON_REQUEST, 'the MRP-only card says on request');
  eq(cardMrp?.badge, null, 'and carries no discount badge');
  ok(!list.includes('Save ₹210'), 'nothing on the list claims a saving of ₹210');

  // A priced card beside it, so "carries no discount badge" cannot pass for the
  // wrong reason - namely the selector matching nothing anywhere on the page.
  const cardPriced = await page.evaluate(() => {
    const card = [...document.querySelectorAll('.pcard')]
      .find((c) => c.textContent.includes('Paneer'));
    return card ? card.querySelector('.badge-red')?.innerText.trim() || null : 'no card';
  });
  ok(/\d+% OFF/.test(String(cardPriced)),
    `a priced card with an MRP still shows its discount badge (saw ${cardPriced})`);

  console.log('\nThe product page, unpriced (no price field at all)');
  const ask = await openProduct('zztest-noprice');
  ok(ask.includes(PRICE_ON_REQUEST), 'the product page says "Price on request"');
  ok(!ask.includes('₹0'), 'no ₹0 anywhere on it');
  const askBox = await priceBox();
  ok(askBox && askBox.startsWith(PRICE_ON_REQUEST), 'the price box leads with the on-request line');
  ok(askBox && /call or message/i.test(askBox), 'and tells the customer how to get a price');
  ok(!askBox || !/₹/.test(askBox), 'and shows no rupee figure in the price box');
  eq(await page.locator('.pd-total').count(), 0, 'there is no running total to be right about');
  const desc = await page.getAttribute('meta[name="description"]', 'content');
  ok(desc && !desc.includes('₹'), 'the share/search description quotes no price');
  ok(desc && /price on request/i.test(desc), 'and says the price is on request instead');
  // The sticky bar on a phone is a separate render of the same number.
  const sticky = await page.locator('.pd-sticky-price').innerText();
  ok(sticky.includes(PRICE_ON_REQUEST), 'the sticky bar says it too');
  ok(!sticky.includes('₹'), 'and quotes no price');

  console.log('\nThe product page, an explicit null price beside an MRP of 210');
  await openProduct('zztest-mrp-only');
  const mrpBox = await priceBox();
  ok(mrpBox && mrpBox.startsWith(PRICE_ON_REQUEST), 'it says "Price on request"');
  ok(!mrpBox || !mrpBox.includes('210'), 'the MRP is not shown as a price to compare against');
  ok(!mrpBox || !/Save/.test(mrpBox), 'and no saving is advertised');
  eq(await discountBadges(), 0, 'no discount badge on the product');

  console.log('\nA priced product is untouched');
  const priced = await openProduct('high-protein-paneer');
  ok(priced.includes('₹190'), 'it still shows its price');
  ok(priced.includes('₹210'), 'and its MRP struck through');
  ok(/Save\s*₹20/.test(priced), 'and the saving on it');
  ok(priced.includes('Total for'), 'the running total is still there when there is a price');
  ok(await page.locator('.pd-total').count() === 1, 'exactly one running total');
  ok(await discountBadges() === 1, 'and still one discount badge');

  console.log('\nSorting, driven through the control a customer actually uses');
  for (const [sort, label] of [['price-asc', 'cheapest first'], ['price-desc', 'dearest first']]) {
    // The sort is component state set by the <select>, not a URL parameter, so
    // loading /products?sort=... silently leaves the list on "Most Popular" -
    // which is how this check first came to believe the sort was broken when the
    // comparator was not.
    await open('/products', '.pcard, .empty-state');
    await page.selectOption('#sort', sort);
    await page.waitForTimeout(500);
    const order = await page.evaluate(() =>
      [...document.querySelectorAll('.pcard')].map((c) => {
        const h = c.querySelector('h2, h3');
        return h ? h.textContent.trim() : '';
      })
    );
    ok(order.length > 0, `${label}: the page actually rendered cards (${order.length})`);
    const firstUnpriced = order.findIndex((n) => n.startsWith('ZZ Test'));
    ok(firstUnpriced >= 0, `${label}: the unpriced products are on the page`);
    eq(firstUnpriced, order.length - 2,
      `${label}: both unpriced products are the last two, after every priced one`);
    console.log(`        order: ${order.join(' | ')}`);
  }

  console.log('\nThe test never touched the shop');
  eq(reachedOut.length, 0,
    `no request left the machine (${reachedOut.join(', ') || 'none'})`);
} catch (err) {
  fails.push(`threw: ${err.message}`);
  console.error('\n  ERROR', err);
} finally {
  if (browser) await browser.close();
  if (server) server.close();
  // Put the owner's seed back exactly as it was. This runs even if the test
  // threw, because a catalogue left with two test products in it is the one
  // outcome that must not happen.
  if (seedBackup) {
    await writeFile(SEED, seedBackup, 'utf8');
    console.log('\nSeed restored');
    try {
      build();
      console.log('Rebuilt without the test products');
    } catch (e) {
      console.error('  rebuild after restore FAILED:', e.message);
    }
  }
}

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.log('  - ' + f);
  process.exit(1);
}
