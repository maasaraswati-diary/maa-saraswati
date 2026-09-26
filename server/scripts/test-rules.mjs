/**
 * Security-rules test for the approval workflow.
 *
 * Runs inside `firebase emulators:exec`, so the Firestore emulator enforces
 * firestore.rules exactly as production will. The point of this file is to be
 * certain the rules are right BEFORE anyone has to paste them into the console.
 *
 * Notes on the shape of this test:
 *   - fixtures are written with the Admin SDK, which bypasses rules, because
 *     rules cannot be relaxed from inside the thing being tested
 *   - requests go through the REST API; the emulator reads the caller's identity
 *     from the bearer token's claims, so a hand-rolled JWT is enough to act as
 *     any user. Anonymous requests send no Authorization header at all.
 *
 * What must hold:
 *   - the public can read the storefront and nothing else
 *   - a partner can submit a product but cannot make it live
 *   - only the shop owner can approve, which is what puts it on the storefront
 *   - a partner cannot read or touch anyone else's submission
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT = process.env.GCLOUD_PROJECT || 'maa-saraswati-diary';
const DOCS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;

const OWNER = 'kunalkalia261085@gmail.com';
const PARTNER = 'farmer.ram@example.com';
const OTHER = 'someone.else@example.com';

let failures = 0;
function check(name, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failures++;
}

/* ------------------------------------------------------------ identities */

/** A bearer token the emulator will decode into { sub, email }. */
function tokenFor(email) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: `uid-${email}`, email })}.`;
}

const ANON = null; // no header at all: a genuinely anonymous request
const asPartner = tokenFor(PARTNER);
const asOther = tokenFor(OTHER);
const asOwner = tokenFor(OWNER);

/* --------------------------------------------------------- value helpers */

// The fixtures are plain JavaScript values, because the Admin SDK (which writes
// them) stores them verbatim. REST requests need them wrapped, which restify()
// does on the way out.
const s = (v) => ({ stringValue: String(v) });
const n = (v) => ({ doubleValue: Number(v) });
const b = (v) => ({ booleanValue: Boolean(v) });
const arr = (v) => ({ arrayValue: { values: v } });

/** A value that is already in Firestore's own shape is passed through as is. */
const isWrapped = (v) =>
  v &&
  typeof v === 'object' &&
  ['stringValue', 'bytesValue', 'doubleValue', 'integerValue', 'booleanValue',
    'timestampValue', 'nullValue', 'arrayValue', 'mapValue',
  ].some((k) => k in v);

function restify(value) {
  if (isWrapped(value)) return value;
  if (Array.isArray(value)) return arr(value.map(restify));
  if (value && typeof value === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(value)) fields[k] = restify(v);
    return { mapValue: { fields } };
  }
  if (typeof value === 'number') return n(value);
  if (typeof value === 'boolean') return b(value);
  return s(value);
}

/** Top level of a REST document is a `fields` map, not a wrapped mapValue. */
const restifyFields = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, restify(v)]));

function product(over = {}) {
  return {
    slug: 'paneer-200',
    name: 'High Protein Paneer',
    shortName: 'Paneer',
    category: 'Paneer & Cheese',
    price: 190,
    mrp: 210,
    images: ['/images/products/paneer.jpg'],
    image: '/images/products/paneer.jpg',
    description: [],
    highlights: [],
    features: [],
    nutrition: [],
    usage: [],
    faqs: [],
    veg: true,
    inStock: true,
    featured: false,
    rating: 4.5,
    reviewCount: 12,
    ownerEmail: PARTNER,
    ownerName: 'Ram Dairy',
    status: 'pending',
    reviewNote: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

/* ------------------------------------------------------------- transport */

async function raw(path, method, token, body) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${DOCS}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (process.env.VERBOSE || !text.startsWith('{')) {
    console.log(`      [${method} ${path} -> ${res.status}] ${text.slice(0, 300)}`);
  } else {
    console.log(`      [${method} ${path} -> ${res.status}] ${text.slice(0, 300)}`);
  }
  return res.status >= 200 && res.status < 300;
}

const read = (path, token = ANON) => raw(path, 'GET', token);
const write = (path, fields, token) =>
  raw(path, 'PATCH', token, { fields: restifyFields(fields) });
const drop = (path, token) => raw(path, 'DELETE', token);

/** runQuery with a single equality filter. */
async function readWhere(collectionId, field, value, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${DOCS}:runQuery`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: s(value) },
        },
        limit: 50,
      },
    }),
  });
  await res.text();
  return res.status >= 200 && res.status < 300;
}

/* ------------------------------------------------------------------ seed */
initializeApp({ projectId: PROJECT });
const admin = getFirestore();

const approved = product({ status: 'approved', ownerEmail: OWNER });
await admin.collection('shop').doc('prod_paneer').set(approved);
await admin.collection('products').doc('prod_paneer').set(approved);
await admin
  .collection('products')
  .doc('prod_secret')
  .set(product({ slug: 'secret-ghee', name: 'Secret Ghee' }));
await admin.collection('enquiries').doc('enq_1').set({
  name: 'Kunal',
  email: 'kunal@example.com',
  phone: '9814391854',
  subject: 'General enquiry',
  product: '',
  message: 'Do you deliver in Gurdaspur?',
  status: 'new',
  createdAt: '2026-01-02T00:00:00.000Z',
});

// Prove the fixtures are actually there before testing anything against them.
{
  const snap = await admin.collection('products').get();
  const shop = await admin.collection('shop').get();
  console.log(`\nfixtures: products=[${snap.docs.map((d) => d.id).join(', ')}] shop=[${shop.docs.map((d) => d.id).join(', ')}]\n`);
  if (!snap.docs.length) {
    console.log('FATAL: fixtures did not land in the emulator the REST calls reach.');
    process.exit(1);
  }
}

/* ---------------------------------------------------------------- public */
check('public can list the storefront', await read('/shop'));
check('public can look a product up by slug', await readWhere('shop', 'slug', 'paneer-200', ANON));
check('public can read a live product', await read('/shop/prod_paneer'));
check('public cannot list submissions', !(await read('/products')));
check('public cannot read a pending submission', !(await read('/products/prod_secret')));
check('public cannot read enquiries', !(await read('/enquiries')));
check('public cannot write to the storefront', !(await write('/shop/hack', { name: 'Hack' }, ANON)));
check('public cannot delete from the storefront', !(await drop('/shop/prod_paneer', ANON)));

/* -------------------------------------------------------------- partner */
check('partner can read their own submission', await read('/products/prod_secret', asPartner));
check('partner can list their own submissions', await readWhere('products', 'ownerEmail', PARTNER, asPartner));
check("partner may read a product that is already live", await read('/products/prod_paneer', asPartner));
check("partner cannot read someone else's PENDING submission", !(await read('/products/prod_secret', asOther)));
check('partner cannot list all submissions', !(await read('/products', asPartner)));
check('partner cannot read enquiries', !(await read('/enquiries', asPartner)));

check('partner can submit a product', await write('/products/p_new', product(), asPartner));
check(
  'partner cannot self-approve',
  !(await write('/products/p_new', product({ status: 'approved' }), asPartner))
);
check('partner cannot publish straight to the storefront', !(await write('/shop/p_new', product(), asPartner)));
check('partner cannot post as somebody else', !(await write('/products/p_spoof', product({ ownerEmail: OTHER }), asPartner)));
check("partner cannot edit the owner's live storefront copy", !(await write('/shop/prod_paneer', product({ price: 1 }), asPartner)));
check("partner cannot delete the owner's product", !(await drop('/products/prod_paneer', asPartner)));
check("partner cannot change the owner's product", !(await write('/products/prod_paneer', product({ price: 1 }), asPartner)));
check(
  'partner may send an enquiry',
  await write('/enquiries/enq_2', {
    name: 'Ram',
    email: 'ram@example.com',
    message: 'Hello there, wholesale please',
  }, asPartner)
);
check('partner cannot read that enquiry back', !(await read('/enquiries/enq_2', asPartner)));
check('a stranger cannot read the partner submission', !(await read('/products/prod_secret', asOther)));

/* ---------------------------------------------------------------- owner */
check('owner can list every submission', await read('/products', asOwner));
check('owner can read any submission', await read('/products/prod_secret', asOwner));
check('owner can list pending submissions', await readWhere('products', 'status', 'pending', asOwner));
check('owner can read enquiries', await read('/enquiries', asOwner));
check('owner can approve (publish to storefront)', await write('/shop/p_new', product({ status: 'approved' }), asOwner));
check(
  'owner can send a product back with a note',
  await write('/products/p_new', product({ status: 'rejected', reviewNote: 'Price theek karo' }), asOwner)
);
check('owner can pull a product off the storefront', await drop('/shop/p_new', asOwner));
check('owner can delete a submission', await drop('/products/p_spoof', asOwner));
check('nobody can write a user profile that is not theirs', !(await write('/users/someone-else', { a: 1 }, asPartner)));
check('a partner can write their own profile', await write(`/users/${encodeURIComponent('uid-' + PARTNER)}`, { shop: 'Ram Dairy' }, asPartner));

/* ----------------------------------------------------------------- uploads */
// Stored as raw WebP bytes, which is a bytesValue on the REST API.
const bytes = (n) => ({ bytesValue: Buffer.alloc(n, 7).toString('base64') });

const upload = (over = {}) => ({
  ownerEmail: PARTNER,
  name: 'paneer.jpg',
  large: bytes(80_000),
  thumb: bytes(20_000),
  mime: 'image/webp',
  width: 1100,
  height: 1100,
  bytes: 80_000,
  createdAt: '2026-01-03T00:00:00.000Z',
  ...over,
});

// The emulator does not relax rules for REST callers, so the fixture has to go
// in with the Admin SDK the way the other collections do.
await admin.collection('uploads').doc('img_seed').set({
  ownerEmail: OWNER,
  name: 'seed.jpg',
  large: Buffer.alloc(80_000, 7),
  thumb: Buffer.alloc(20_000, 7),
  mime: 'image/webp',
  width: 1100,
  height: 1100,
  bytes: 80_000,
  createdAt: '2026-01-03T00:00:00.000Z',
});

check('anyone can read an uploaded picture', await read('/uploads/img_seed'));
check('a partner can upload a picture for themselves', await write('/uploads/img_p', upload(), asPartner));
check('a partner cannot upload as somebody else', !(await write('/uploads/img_s', upload({ ownerEmail: OTHER }), asPartner)));
check(
  'a partner cannot upload a picture past the size ceiling',
  !(await write('/uploads/img_big', upload({ large: bytes(1_000_000) }), asPartner))
);
check('a partner cannot change an existing picture', !(await write('/uploads/img_p', upload(), asPartner)));
check('a partner cannot delete a picture', !(await drop('/uploads/img_p', asPartner)));
check('a partner cannot delete the shop picture', !(await drop('/uploads/img_seed', asPartner)));
check('the owner can delete a picture', await drop('/uploads/img_p', asOwner));
check('the owner can upload too', await write('/uploads/img_o', upload({ ownerEmail: OWNER }), asOwner));
check('the owner can delete the shop picture', await drop('/uploads/img_seed', asOwner));

/* ---------------------------------------------------------- testimonials */
const review = {
  name: 'Rahul',
  role: 'Runs a Sweet House',
  text: 'The paneer holds its texture and delivery is never late.',
  rating: 5,
  sortOrder: 0,
};

check('anyone can read customer reviews', await read('/testimonials', ANON));
check('a partner can read customer reviews', await read('/testimonials', asPartner));
check('a partner cannot add a review', !(await write('/testimonials/t_bad', review, asPartner)));
check('a partner cannot edit a review', !(await write('/testimonials/t_bad', review, asPartner)));
check('a partner cannot delete a review', !(await drop('/testimonials/t_bad', asPartner)));
check('the owner can add a review', await write('/testimonials/t_1', review, asOwner));
check('the owner can edit a review', await write('/testimonials/t_1', { ...review, rating: 4 }, asOwner));
check('the owner can delete a review', await drop('/testimonials/t_1', asOwner));

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}\n`);
process.exit(failures === 0 ? 0 : 1);
