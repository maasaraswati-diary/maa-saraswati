/**
 * The enquiry alert: the Worker, and the button the customer is offered.
 *
 * Two halves, for two reasons.
 *
 * The Worker half runs with the network, KV and Telegram all faked out. It is the
 * only way to test the parts that matter - that a lead's name and number go
 * out, that their message does not, that one address cannot make the owner's
 * phone ring fifty times, that nobody but the owner can send a test, and that a
 * provider which refuses is reported as refused - without putting those fifty
 * notifications on an actual handset, or needing a real bot token.
 *
 * The refusal case is here because it is the one that cost a day: the first
 * version of this did not look at the response, so a provider swallowing every
 * message looked exactly like one delivering them, and the owner was told the
 * alerts worked.
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
const PORT = 8799;

/* Stand-ins. Anything but these would be a real credential in a test. */
const TOKEN = '123456:TEST-TOKEN-NOT-REAL';
const OWNER_CHAT = '99887766';
const CLIENT_CHAT = '55667788';

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
 * Stands in for the network. Everything the Worker asks for is either Telegram
 * or Google's identity service, and both are recorded rather than reached, so a
 * test can never ring a real phone or need a real token.
 */
function fakeNetwork({ asEmail, telegram = 'ok' } = {}) {
  const calls = { telegram: [], identity: [] };
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes('identitytoolkit')) {
      calls.identity.push(u);
      return new Response(JSON.stringify(asEmail ? { users: [{ email: asEmail }] } : { users: [] }),
        { status: 200 });
    }
    if (u.includes('api.telegram.org')) {
      calls.telegram.push({ url: u, init });
      if (telegram === 'throw') throw new Error('telegram unreachable');
      if (telegram === 'refuse') {
        return new Response(
          JSON.stringify({ ok: false, description: 'bot was blocked by the user' }),
          { status: 403 }
        );
      }
      return new Response(JSON.stringify({ ok: true, result: { message_id: 7 } }),
        { status: 200 });
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
const call = (body, { search = '', ip = '203.0.113.9', token = '', chats = OWNER_CHAT } = {}) =>
  onRequestPost({
    request: {
      url: `https://site.example/api/notify${search}`,
      headers: new Headers({
        'CF-Connecting-IP': ip,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }),
      json: async () => body,
    },
    env: { VIDEOS: kv, TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: chats },
  });

let kv = fakeKv();
let net = fakeNetwork();
let res = await call(enquiry());
let sent = net.telegram[0];

eq(net.telegram.length, 1, 'one alert is sent');
ok(sent.url === `https://api.telegram.org/bot${TOKEN}/sendMessage`,
  'it goes to Telegram');
eq(sent.init.method, 'POST', 'posted');
const payload = JSON.parse(sent.init.body);
eq(payload.chat_id, OWNER_CHAT, 'addressed to the owner\'s chat');
ok(payload.text.includes('New enquiry - Bulk / wholesale order'),
  'the first line says what it is about');
ok(payload.text.includes('Ramesh Kaur'), 'the name is in it');
ok(payload.text.includes('98765 43210'), 'the phone number is in it');
ok(!payload.text.includes('sweet shop'),
  'the customer\'s own message is NOT sent to a third party');
eq(payload.disable_web_page_preview, true, 'no link preview is fetched for the text');
eq(payload.reply_markup?.inline_keyboard?.[0]?.[0]?.url,
  'https://maa-saraswati-diary.pages.dev/partner/products?tab=enquiries',
  'and there is a button leading straight to the enquiry');

const firstReply = await res.text();
eq(JSON.parse(firstReply), { ok: true }, 'and the page is told it worked');
ok(!firstReply.includes(TOKEN) && !firstReply.includes(OWNER_CHAT),
  'the reply carries neither the token nor the chat');

console.log('\nBoth the owner and the client get it');
kv = fakeKv();
net = fakeNetwork();
res = await call(enquiry(), { chats: `${OWNER_CHAT}, ${CLIENT_CHAT}` });
eq(net.telegram.length, 2, 'two alerts, one for each chat');
eq(net.telegram.map((t) => JSON.parse(t.init.body).chat_id), [OWNER_CHAT, CLIENT_CHAT],
  'in the order the list gives them');
const texts = net.telegram.map((t) => JSON.parse(t.init.body).text);
eq(texts[0], texts[1], 'and carrying the same text - the bodies differ only in chat_id');
eq(JSON.parse(await res.text()), { ok: true }, 'the page is told it worked');

kv = fakeKv();
net = fakeNetwork();
res = await call(enquiry(), { chats: `${OWNER_CHAT} , , ${CLIENT_CHAT} ` });
eq(net.telegram.length, 2, 'blank entries and stray spaces in the list are ignored');
const texts2 = net.telegram.map((t) => JSON.parse(t.init.body).text);
eq(texts2[0], texts2[1], 'and the text still matches');

console.log('\nOne blocked handset does not cost the other its enquiry');
kv = fakeKv();
net = fakeNetwork();
// Telegram refuses the owner and accepts the client, from one bot.
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes('identitytoolkit')) {
    return new Response(JSON.stringify({ users: [{ email: 'kunalkalia261085@gmail.com' }] }), { status: 200 });
  }
  if (u.includes('api.telegram.org')) {
    net.telegram.push({ url: u, init });
    if (JSON.parse(init.body).chat_id === OWNER_CHAT) {
      return new Response(JSON.stringify({ ok: false, description: 'bot was blocked by the user' }), { status: 403 });
    }
    return new Response(JSON.stringify({ ok: true, result: { message_id: 8 } }), { status: 200 });
  }
  throw new Error('unexpected');
};
res = await call(enquiry(), { search: '?test=1', token: 't', chats: `${OWNER_CHAT},${CLIENT_CHAT}` });
eq(net.telegram.length, 2, 'the blocked chat was still attempted');
eq(res.status, 200, 'but the one that worked means the test passes');
eq(JSON.parse(await res.text()).chats, 1, 'and the panel is told how many arrived');

console.log('\nOne phone, one alert every twenty minutes');
// Its own state, because the section above leaves a bot that refuses on purpose
// installed and a count of calls that is about a different list of chats.
kv = fakeKv();
net = fakeNetwork();
await call(enquiry(), { ip: '203.0.113.9' });
eq(net.telegram.length, 1, 'one alert for the first enquiry from an address');
res = await call(enquiry({ name: 'Second caller', phone: '90000 00000' }));
eq(net.telegram.length, 1, 'a second enquiry from the same address sends nothing');
eq(JSON.parse(await res.text()), { ok: true }, 'and is still reported as fine to the page');
ok(kv.store.size > 0, 'the address was remembered');

await call(enquiry(), { ip: '198.51.100.4' });
eq(net.telegram.length, 2, 'a different address does get an alert');

console.log('\nA provider that refuses is reported, not swallowed');
kv = fakeKv();
net = fakeNetwork({ telegram: 'refuse' });
res = await call(enquiry());
eq(res.status, 200, 'the page still gets 200 - the lead is in Firestore either way');
eq(JSON.parse(await res.text()), { ok: true }, 'and a plain success');
eq(net.telegram.length, 1, 'the alert was attempted once');
console.log('\nA rate limiter that cannot store must not swallow the lead');
kv = { get: async () => { throw new Error('kv down'); }, put: async () => { throw new Error('kv down'); } };
net = fakeNetwork();
res = await call(enquiry());
eq(net.telegram.length, 1, 'the alert is sent anyway');

console.log('\nWith no bot set up, the shop still works and says so');
kv = fakeKv();
net = fakeNetwork();
res = await onRequestPost({
  request: {
    url: 'https://site.example/api/notify',
    headers: new Headers({ 'CF-Connecting-IP': '203.0.113.1' }),
    json: async () => enquiry(),
  },
  env: { VIDEOS: kv },
});
eq(net.telegram.length, 0, 'nothing is sent');
eq(JSON.parse(await res.text()), { ok: true }, 'and the page is told it worked');

net = fakeNetwork({ asEmail: 'kunalkalia261085@gmail.com' });
res = await onRequestPost({
  request: {
    url: 'https://site.example/api/notify?test=1',
    headers: new Headers({ Authorization: 'Bearer x' }),
    json: async () => ({}),
  },
  env: { VIDEOS: kv },
});
// Signed in as the owner, so this gets past the who-are-you check and reaches
// the "no bot" one. The order matters: an owner with no bot gets told so.
eq(res.status, 501, 'the test button is told the alerts are not set up yet');
ok((await res.text()).includes('Telegram'), 'and says what is missing');
eq(net.telegram.length, 0, 'having sent nothing');

net = fakeNetwork();
res = await onRequestPost({
  request: {
    url: 'https://site.example/api/notify?test=1',
    headers: new Headers({ Authorization: 'Bearer x' }),
    json: async () => ({}),
  },
  env: { VIDEOS: kv },
});
eq(res.status, 403, 'and a stranger with no bot configured is still refused first');

console.log('\nOnly the owner may send a test');
kv = fakeKv();
net = fakeNetwork();
res = await call({}, { search: '?test=1' });
eq(res.status, 401, 'no token is refused');
eq(net.telegram.length, 0, 'and nothing is sent');

kv = fakeKv();
net = fakeNetwork({ asEmail: 'someone@example.com' });
res = await call({}, { search: '?test=1', token: 'fake' });
eq(res.status, 403, 'a signed-in stranger is refused');
eq(net.telegram.length, 0, 'and nothing is sent');

kv = fakeKv();
net = fakeNetwork({ asEmail: 'kunalkalia261085@gmail.com' });
res = await call({}, { search: '?test=1', token: 'fake' });
eq(res.status, 200, 'the owner is allowed');
eq(net.telegram.length, 1, 'and one test alert goes out');
eq(JSON.parse(await res.text()).sent, true, 'the panel is told it was sent');

// A test must not spend the window, or the owner's first real enquiry would be
// the one that gets no alert.
kv = fakeKv();
net = fakeNetwork({ asEmail: 'kunalkalia261085@gmail.com' });
await call({}, { search: '?test=1', token: 'fake' });
await call(enquiry(), { ip: '192.0.2.7' });
eq(net.telegram.length, 2, 'a real enquiry still alerts right after a test');

// A refused test must be reported as refused, or the button is the one thing
// that would have caught the quota being exhausted.
kv = fakeKv();
net = fakeNetwork({ asEmail: 'kunalkalia261085@gmail.com', telegram: 'refuse' });
res = await call({}, { search: '?test=1', token: 'fake' });
eq(res.status, 502, 'a test that the provider refuses is not reported as sent');
ok((await res.text()).includes('403'), 'and carries the provider\'s status');

console.log('\nNonsense in the body is trimmed, not forwarded');
kv = fakeKv();
net = fakeNetwork();
await call(enquiry({ name: 'A'.repeat(500), phone: 'x'.repeat(400), subject: 'y'.repeat(400) }));
sent = net.telegram[0];
const body = JSON.parse(sent.init.body).text;
ok(body.length < 400, `the whole message is bounded (${body.length} chars)`);
// Not because angle brackets are dangerous here - this is a text message, and
// stripping them would mangle a real one like "Paneer < 1 kg". Because the phone
// number is the one field an attacker picks to look like a different caller, and
// it is what shows on the lock screen. It has to arrive as one line: a value
// carrying its own newlines could add a second line to the alert and read as
// somebody else.
kv = fakeKv();
net = fakeNetwork();
await call(enquiry({ phone: '98765 43210\nURGENT: call me back on 99999' }));
sent = net.telegram[0];
const text = JSON.parse(sent.init.body).text;
const phoneLine = text.split('\n').find((l) => l.startsWith('Phone:'));
ok(!/\n/.test(phoneLine), 'a phone number carrying its own newlines arrives as one line');
ok(phoneLine.length <= 'Phone: '.length + 24,
  `and no longer than a phone number can be (${phoneLine.length} chars)`);
ok(phoneLine.includes('URGENT'), 'the text is kept, just squashed rather than dropped');
ok(text.split('\n').filter((l) => l.startsWith('Phone:')).length === 1,
  'so it cannot add a second line pretending to be another field');

kv = fakeKv();
net = fakeNetwork();
await call({}, { });
sent = net.telegram[0];
ok(JSON.parse(sent.init.body).text.includes('General enquiry'),
  'an empty enquiry still says something sensible');
ok(JSON.parse(sent.init.body).text.includes('Someone'), 'and does not say "undefined"');

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
  const waText = decodeURIComponent(new URL(href).searchParams.get('text') || '');
  console.log('        WhatsApp message:\n' + waText.split('\n').map((l) => '          ' + l).join('\n'));
  ok(/^Name: Ramesh Kaur/.test(waText), 'it is addressed with the name');
  ok(waText.includes('Phone: 98765 43210'), 'carries the phone number');
  ok(waText.includes('Subject: Bulk / wholesale order'), 'and the subject');
  ok(waText.includes('I run a sweet shop and need 10 kg every morning.'),
    'and the whole message, which the page had just cleared');
  ok(!/undefined|\[object/.test(waText), 'with no undefined in it');
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
