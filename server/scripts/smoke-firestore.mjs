/**
 * End-to-end smoke test for the DEPLOYED code path.
 *
 * Runs inside `firebase emulators:exec`, so Cloud Functions and Firestore are
 * emulated locally. It proves the code that will run in production works:
 * Firestore storage, first-run seeding, the API, admin auth, and the enquiry
 * flow. Exits non-zero on the first failure.
 */
/**
 * In the Functions emulator the app is mounted at
 *   http://127.0.0.1:5001/<project>/<region>/<functionName>
 * and the remaining path is what the function sees - which is why the same
 * `/api/...` paths work in production behind the Hosting rewrite.
 */
const PROJECT = process.env.GCLOUD_PROJECT || 'maa-saraswati-diary';
const REGION = process.env.FUNCTION_REGION || 'asia-south1';
const BASE =
  process.env.API_BASE ||
  `http://127.0.0.1:5001/${PROJECT}/${REGION}/api`;

let failures = 0;

function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`);
  if (!ok) failures++;
}

async function call(path, { method = 'GET', body, token, raw } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return raw ? res : { status: res.status, data: await res.json().catch(() => ({})) };
}

const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL || 'maasaraswati449@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

console.log(`\n--- smoke test against ${BASE} (project ${PROJECT}) ---\n`);

// 1. health + which storage is active
const health = await call('/api/health');
check('health responds', health.status === 200, JSON.stringify(health.data));
check(
  'using Firestore (not local JSON)',
  health.data?.storage === 'firestore',
  `storage=${health.data?.storage}`
);

// 2. the starter catalogue was seeded on cold start
const list = await call('/api/products');
check('products seeded on first boot', list.data?.count === 8, `count=${list.data?.count}`);
check(
  'seeded product has images',
  Array.isArray(list.data?.products?.[0]?.images) &&
    list.data.products[0].images.length > 0
);

// 3. categories
const cats = await call('/api/products/categories');
check('categories endpoint', Array.isArray(cats.data?.categories) && cats.data.categories.length > 1);

// 4. single product by slug
const paneer = await call('/api/products/high-protein-paneer');
check('product by slug', paneer.data?.product?.name === 'High Protein Paneer', paneer.data?.product?.name);
check('related products returned', (paneer.data?.related || []).length > 0);

// 5. filtering
const filtered = await call('/api/products?category=Milk');
check('category filter', filtered.data?.count === 1, `count=${filtered.data?.count}`);

// 6. admin auth - wrong password rejected
const bad = await call('/api/admin/login', {
  method: 'POST',
  body: { email: ADMIN_EMAIL, password: 'nope' },
});
check('bad password rejected', bad.status === 401, `status=${bad.status}`);

// 7. admin auth - correct password
const login = await call('/api/admin/login', {
  method: 'POST',
  body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
});
check('admin login', login.status === 200 && Boolean(login.data?.token), `status=${login.status}`);
const token = login.data?.token;

// 8. protected route without a token
const noAuth = await call('/api/admin/products');
check('protected route blocked', noAuth.status === 401, `status=${noAuth.status}`);

// 9. protected route with a token
const adminProducts = await call('/api/admin/products', { token });
check('admin products readable', adminProducts.status === 200 && adminProducts.data?.count === 8);

// 10. stats
const stats = await call('/api/admin/stats', { token });
check('stats endpoint', stats.status === 200 && stats.data?.totalProducts === 8, JSON.stringify(stats.data));

// 11. create -> read -> update -> delete a product
const created = await call('/api/admin/products', {
  method: 'POST',
  token,
  body: {
    name: 'Smoke Test Paneer',
    category: 'Paneer & Cheese',
    price: 111,
    packSize: '100 g',
    images: ['/images/products/paneer-poster.jpeg'],
  },
});
check('create product', created.status === 201 && Boolean(created.data?.product?.id), `status=${created.status}`);
const newId = created.data?.product?.id;

const afterCreate = await call('/api/products');
check('new product visible publicly', afterCreate.data?.count === 9, `count=${afterCreate.data?.count}`);

const updated = await call(`/api/admin/products/${newId}`, {
  method: 'PUT',
  token,
  body: { name: 'Smoke Test Paneer', price: 222, images: ['/images/products/paneer-poster.jpeg'] },
});
check('update product', updated.data?.product?.price === 222, `price=${updated.data?.product?.price}`);

const deleted = await call(`/api/admin/products/${newId}`, { method: 'DELETE', token });
check('delete product', deleted.status === 200);

const afterDelete = await call('/api/products');
check('catalogue back to 8', afterDelete.data?.count === 8, `count=${afterDelete.data?.count}`);

// 12. enquiry validation
const invalid = await call('/api/enquiries', {
  method: 'POST',
  body: { name: 'A', email: 'bad', message: 'hi' },
});
check('enquiry validation rejects bad input', invalid.status === 400, `status=${invalid.status}`);

// 13. enquiry submission lands in the database
const enquiry = await call('/api/enquiries', {
  method: 'POST',
  body: {
    name: 'Smoke Tester',
    email: 'smoke@example.com',
    phone: '9814300000',
    subject: 'Bulk / wholesale order',
    message: 'Automated smoke test enquiry, please ignore.',
  },
});
check('enquiry accepted', enquiry.status === 201, `status=${enquiry.status}`);

const enqList = await call('/api/admin/enquiries', { token });
check('enquiry stored', (enqList.data?.enquiries || []).some((e) => e.email === 'smoke@example.com'));

// 14. unknown route
const missing = await call('/api/does-not-exist');
check('unknown API route 404s', missing.status === 404, `status=${missing.status}`);

console.log(`\n--- ${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'} ---\n`);
process.exit(failures === 0 ? 0 : 1);
