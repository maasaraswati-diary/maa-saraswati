/**
 * The enquiry alert: the Worker, and the button the customer is offered.
 *
 * Two halves, for two reasons.
 *
 * The Worker half runs with the network and KV faked out. It is the only way to
 * test the parts that matter - that a lead's name and number go out, that their
 * message does not, that one address cannot make the owner's phone ring fifty
 * times, and that nobody but the owner can send a test - without putting those
 * fifty notifications on an actual handset.
 *
 * The form half builds the shop with no Firebase in it (see firebase.js,
 * VITE_STATIC_ONLY) so the enquiry can be sent without writing to the owner's
 * live Firestore, and reads the WhatsApp shortcut the customer is shown
 * afterwards.
 *
 *   node e2e/notify.mjs
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

import { onRequestPost } from '../functions/api/notify.js';

const require = createRequire('C:/Users/DELL/AppData/Roaming/npm/');
const { chromium } = require('playwright');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = join(ROOT, 'client', 'dist');
const PORT = 8798;

let pass = 0;
const fails = [];
const ok = (cond, what) => {
  if (cond) { pass += 1; console.log(`  pass  ${what}`); }
  else { fails.push(what); console.log(`  FAIL  ${what}`); }
};
// Compared by value, not by identity: `{ ok: true }` from JSON.parse() is never
// the same object as a literal, so `===` calls two equal bodies a failure and
// prints them identically, which is the least useful kind of wrong.
const eq = (got, want, what) =>
  ok(JSON.stringify(got) === JSON.stringify(want),
    `${what}  (got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)})`);

/* ================================================================ Worker half */

console.log('\nThe alert the owner gets');

/** A KV that only knows how to get and put, which is all this uses. */
function fakeKv() {
  const store = new Map();
  return {
    store,
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v) { store.set(k, v); },
  };
}

/**
 * Stands in for the network. Everything the Worker asks for is either the push
 * provider or Google's identity service, and both are recorded rather than
 * reached, so a test can never ring a real phone or need a real token.
 */
function fakeNetwork({ asEmail, ntfyFails = false } = {}) {
  const calls = { ntfy: [], identity: [] };
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes('identitytoolkit')) {
      calls.identity.push(u);
      const body = asEmail ? { users: [{ email: asEmail }] } : { users: [] };
      return new Response(JSON.stringify(body), { status: 200 });
    }
    if (u.includes('ntfy.sh')) {
      calls.ntfy.push({ url: u, init });
      if (ntfyFails) throw new Error('ntfy is down');
      return new Response('ok', { status: 200 });
    }
    throw new Error(`unexpected request: ${u}`);
  };
  return calls;
}

const enquiry = (over = {}) => ({
  name: 'Ramesh Kaur',
  phone: '98765 43210',
  subject: 'Bulk / wholesale order',
  product: 'Paneer',
  message: 'I run a sweet shop and need 10 kg every morning. What is your rate?',
  ...over,
});

/** A call the way the page makes it: no token, no headers, JSON body. */
const call = (body, { search = '', ip = '203.0.113.9', token = '' } = {}) =>
  onRequestPost({
    request: {
      url: `https://site.example/api/notify${search}`,
      headers: new Headers({
        'CF-Connecting-IP': ip,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }),
      json: async () => body,
    },
    env: { VIDEOS: kv },
  });

let kv = fakeKv();
let net = fakeNetwork();
let res = await call(enquiry());
let sent = net.ntfy[0];

eq(net.ntfy.length, 1, 'one alert is sent');
ok(/ntfy\.sh\/maa-enq-[a-f0-9]{24}/.test(sent.url),
  `it goes to the private topic, not somewhere guessable (${sent.url.replace(/maa-enq-(\w{6})\w+/, 'maa-enq-$1…')})`);
eq(sent.init.method, 'POST', 'posted');
ok(String(sent.init.headers.Title).includes('Bulk / wholesale order'),
  'the title says what it is about');
ok(String(sent.init.body).includes('Ramesh Kaur'), 'the name is in it');
ok(String(sent.init.body).includes('98765 43210'), 'the phone number is in it');
ok(String(sent.init.headers.Click).includes('/partner/products?tab=enquiries'),
  'tapping it opens the enquiries tab');
ok(!String(sent.init.body).includes('sweet shop'),
  'the customer\'s own message is NOT sent to a third party');

// Read the body once. A Response can only be read once, and asking for a clone
// afterwards is a crash rather than a second look.
const firstReply = await res.text();
eq(JSON.parse(firstReply), { ok: true }, 'and the page is told it worked');
ok(!firstReply.includes('maa-enq'), 'the reply does not carry the topic');

console.log('\nOne phone, one alert every twenty minutes');
eq(net.ntfy.length, 1, 'still one after the first enquiry');
res = await call(enquiry({ name: 'Second caller', phone: '90000 00000' }));
eq(net.ntfy.length, 1, 'a second enquiry from the same address sends nothing');
eq(await res.json(), { ok: true }, 'and is still reported as fine to the page');
ok(kv.store.size > 0, 'the address was remembered');

await call(enquiry(), { ip: '198.51.100.4' });
eq(net.ntfy.length, 2, 'a different address does get an alert');

console.log('\nA push provider that is down is not the customer\'s problem');
kv = fakeKv();
net = fakeNetwork({ ntfyFails: true });
res = await call(enquiry());
eq(res.status, 200, 'the page still gets 200');
eq(await res.json(), { ok: true }, 'and a plain success');
eq(net.ntfy.length, 1, 'the alert was attempted once');

console.log('\nA rate limiter that cannot store must not swallow the lead');
kv = { get: async () => { throw new Error('kv down'); }, put: async () => { throw new Error('kv down'); } };
net = fakeNetwork();
res = await call(enquiry());
eq(net.ntfy.length, 1, 'the alert is sent anyway');

console.log('\nOnly the owner may send a test');
net = fakeNetwork();
res = await call({}, { search: '?test=1' });
eq(res.status, 401, 'no token is refused');
eq(net.ntfy.length, 0, 'and nothing is sent');

kv = fakeKv();
net = fakeNetwork({ asEmail: 'someone@example.com' });
res = await call({}, { search: '?test=1', token: 'fake' });
eq(res.status, 403, 'a signed-in stranger is refused');
eq(net.ntfy.length, 0, 'and nothing is sent');

kv = fakeKv();
net = fakeNetwork({ asEmail: 'kunalkalia261085@gmail.com' });
res = await call({}, { search: '?test=1', token: 'fake' });
eq(res.status, 200, 'the owner is allowed');
eq(net.ntfy.length, 1, 'and one test alert goes out');
eq((await res.json()).sent, true, 'the panel is told it was sent');
// A test must not spend the window, or the owner's first real enquiry would be
// the one that gets no alert.
kv = fakeKv();
net = fakeNetwork({ asEmail: 'kunalkalia261085@gmail.com' });
await call({}, { search: '?test=1', token: 'fake' });
await call(enquiry(), { ip: '192.0.2.7' });
eq(net.ntfy.length, 2, 'a real enquiry still alerts right after a test');

console.log('\nNonsense in the body is trimmed, not forwarded');
kv = fakeKv();
net = fakeNetwork();
await call(enquiry({
  name: 'A'.repeat(500),
  phone: '<script>alert(1)</script>',
  subject: 'x'.repeat(400),
}));
sent = net.ntfy[0];
ok(String(sent.init.headers.Title).length < 120, 'the title is bounded');
ok(String(sent.init.body).length < 700, 'the body is bounded');
// Not because angle brackets are dangerous here - ntfy draws this as text, and
// stripping them would mangle a real message like "Paneer < 1 kg". Because the
// phone number is the one field an attacker picks to look like a different
// caller, and it is what shows on the lock screen. It has to arrive as one
// line: a value carrying its own newlines could add a second line to the alert
// and read as somebody else.
kv = fakeKv();
net = fakeNetwork();
await call(enquiry({ phone: '98765 43210\nURGENT: call me back on 99999' }));
sent = net.ntfy[0];
const phoneLine = String(sent.init.body).split('\n').find((l) => l.startsWith('Phone:'));
ok(!/\n/.test(phoneLine), 'a phone number carrying its own newlines arrives as one line');
ok(phoneLine.length <= 'Phone: '.length + 24,
  `and no longer than a phone number can be (${phoneLine.length} chars)`);
ok(phoneLine.includes('URGENT'), 'the text is kept, just squashed rather than dropped');
ok(String(sent.init.body).split('\n').filter((l) => l.startsWith('Phone:')).length === 1,
  'so it cannot add a second line pretending to be another field');

kv = fakeKv();
net = fakeNetwork();
res = await call({}, { });            // no name, no phone, no subject
sent = net.ntfy[0];
ok(String(sent.init.headers.Title).includes('General enquiry'), 'an empty enquiry still says something sensible');
ok(String(sent.init.body).includes('Someone'), 'and does not say "undefined"');

/* ================================================================= form half */

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.png': 'image/png', '.woff2': 'font/woff2',
};

let server = null;
let browser = null;
try {
  const client = join(ROOT, 'client');
  execFileSync(process.execPath, [join(client, 'scripts', 'sync-catalogue.mjs')], {
    cwd: client, stdio: 'pipe',
  });
  execFileSync(
    process.execPath,
    [join(client, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'],
    { cwd: client, stdio: 'pipe', env: { ...process.env, VITE_STATIC_ONLY: '1' } }
  );

  server = createServer(async (req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let file = join(DIST, url.replace(/^\/+/, ''));
    if (existsSync(file) && !extname(file)) file += '.html';
    if (!existsSync(file) || !file.startsWith(DIST)) file = join(DIST, 'index.html');
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end('no'); }
  });
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

  const notifyBodies = [];
  let enquiryPosts = 0;

  // The enquiry write is answered here rather than in Firestore, so no test
  // enquiry lands in the owner's real list.
  await page.route('**/api/enquiries', (route) => {
    enquiryPosts += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Thank you. We will call you back.' }),
    });
  });
  await page.route('**/api/notify', (route) => {
    notifyBodies.push(JSON.parse(route.request().postData() || '{}'));
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });

  console.log('\nThe contact form');
  await page.goto(`http://127.0.0.1:${PORT}/contact`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#enq-name', { timeout: 40000 });

  await page.fill('#enq-name', 'Ramesh Kaur');
  await page.fill('#enq-email', 'ramesh@example.com');
  await page.fill('#enq-phone', '98765 43210');
  await page.selectOption('#enq-subject', 'Bulk / wholesale order');
  await page.fill('#enq-message', 'I run a sweet shop and need 10 kg every morning.');
  await page.click('button[type="submit"]');
  await page.waitForSelector('.done-banner', { timeout: 30000 });
  await page.waitForTimeout(600);

  eq(enquiryPosts, 1, 'the enquiry was sent once');
  eq(notifyBodies.length, 1, 'and the owner was alerted once');
  eq(notifyBodies[0]?.name, 'Ramesh Kaur', 'the alert carries the name');
  eq(notifyBodies[0]?.phone, '98765 43210', 'and the phone number');
  eq(notifyBodies[0]?.subject, 'Bulk / wholesale order', 'and the subject');
  ok(!JSON.stringify(notifyBodies[0]).includes('sweet shop'),
    'but not the message the customer wrote');

  const wa = await page.locator('.done-banner a[href*="wa.me"]');
  eq(await wa.count(), 1, 'the customer is offered the WhatsApp shortcut');
  const href = await wa.getAttribute('href');
  const text = decodeURIComponent(new URL(href).searchParams.get('text') || '');
  console.log('        WhatsApp message:\n' + text.split('\n').map((l) => '          ' + l).join('\n'));
  ok(/^Name: Ramesh Kaur/.test(text), 'it is addressed with the name');
  ok(text.includes('Phone: 98765 43210'), 'carries the phone number');
  ok(text.includes('Subject: Bulk / wholesale order'), 'and the subject');
  ok(text.includes('I run a sweet shop and need 10 kg every morning.'),
    'and the whole message, which the page had just cleared');
  ok(!/undefined|\[object/.test(text), 'with no undefined in it');

  // The form is emptied after sending; the shortcut must not be quoting the
  // empty one, which is what "undefined" above would have meant.
  eq(await page.inputValue('#enq-name'), '', 'the form really was cleared');
  ok((await wa.innerText()).toLowerCase().includes('whatsapp'), 'and the button says so');
} catch (err) {
  fails.push(`threw: ${err.message}`);
  console.error('\n  ERROR', err);
} finally {
  if (browser) await browser.close();
  if (server) server.close();
}

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.log('  - ' + f);
  process.exit(1);
}
