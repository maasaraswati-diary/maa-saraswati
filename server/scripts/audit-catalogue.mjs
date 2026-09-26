/**
 * One pass over the whole catalogue: repair anything broken and report what it
 * found. Safe to run whenever something looks off.
 *
 *   node server/scripts/audit-catalogue.mjs
 *
 * It checks, for every product:
 *   - the pictures it points at actually exist (a real file, or an upload doc)
 *   - the first picture matches the `image` field the card renders
 *   - an approved product's storefront copy matches its submission
 * and it fixes what it can, printing every change.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..');
const PUBLIC = path.join(ROOT, 'client', 'public');

const key = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'maa-saraswati-diary-firebase-adminsdk-fbsvc-d817071b83.json'), 'utf8')
);
initializeApp({ credential: cert(key), projectId: key.project_id });
const db = getFirestore();

/** The picture each product shipped with, used to repair a lost one. */
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'server', 'seed', 'products.json'), 'utf8'));
const SEED_IMAGES = new Map(
  (Array.isArray(seed) ? seed : seed.products).map((p) => [p.id, p.images || []])
);

let fixed = 0;
let problems = 0;
const note = (msg) => console.log('  ' + msg);

const uploads = new Set((await db.collection('uploads').get()).docs.map((d) => d.id));

/** Does this picture resolve to something that will actually render? */
function pictureExists(ref) {
  const value = String(ref || '');
  if (!value) return false;
  if (value.startsWith('upload:')) return uploads.has(value.slice(7));
  return fs.existsSync(path.join(PUBLIC, value.replace(/^\//, '')));
}

/** Drop pictures that go nowhere; fall back to the seed picture if all do. */
function repairImages(id, images) {
  const kept = (images || []).filter(pictureExists);
  if (kept.length) return { images: kept, changed: kept.length !== (images || []).length };
  const fallback = SEED_IMAGES.get(id) || [];
  return { images: fallback, changed: true, restored: true };
}

for (const collection of ['products', 'shop']) {
  const snap = await db.collection(collection).get();
  console.log(`\n${collection} (${snap.size})`);

  for (const doc of snap.docs) {
    const data = doc.data();
    const patch = {};

    const { images, changed, restored } = repairImages(doc.id, data.images);
    if (changed) {
      patch.images = images;
      patch.image = images[0] || '';
      fixed += 1;
      note(
        `${doc.id}: ${restored ? 'picture restored from seed' : 'dropped dead picture'} -> ${JSON.stringify(images)}`
      );
    } else if (data.image !== (images[0] || '')) {
      patch.image = images[0] || '';
      fixed += 1;
      note(`${doc.id}: image field did not match the first picture -> ${patch.image}`);
    }

    if (Object.keys(patch).length) {
      await doc.ref.set(patch, { merge: true });
    }
  }
}

/* An approved product's two copies must agree, or the panel and the website
   drift apart - which is exactly how a picture change goes unnoticed. */
const drafts = await db.collection('products').get();
console.log('\nkeeping the storefront in step with approved products');
for (const doc of drafts.docs) {
  const data = doc.data();
  if (data.status !== 'approved') continue;
  const live = await db.collection('shop').doc(doc.id).get();
  if (!live.exists) {
    await db.collection('shop').doc(doc.id).set({ ...data, status: 'approved' });
    fixed += 1;
    note(`${doc.id}: was missing from the storefront, published`);
    continue;
  }

  const diff = Object.keys(data).filter(
    (k) => !['ownerEmail', 'ownerName', 'createdAt', 'order', 'reviewNote'].includes(k)
      && JSON.stringify(live.data()[k]) !== JSON.stringify(data[k])
  );
  if (diff.length) {
    await db.collection('shop').doc(doc.id).set(data, { merge: true });
    fixed += 1;
    note(`${doc.id}: storefront was out of date on ${diff.join(', ')}`);
  }
}

/* Anything in the storefront that has no submission behind it is orphaned. */
const approved = new Set(drafts.docs.filter((d) => d.data().status === 'approved').map((d) => d.id));
const shop = await db.collection('shop').get();
for (const doc of shop.docs) {
  if (!approved.has(doc.id)) {
    await doc.ref.delete();
    problems += 1;
    note(`${doc.id}: removed from the storefront, its submission is not approved`);
  }
}

const finalShop = await db.collection('shop').get();
const finalDrafts = await db.collection('products').get();
console.log(
  `\nshop=${finalShop.size}  products=${finalDrafts.size}  uploads=${uploads.size}`
);
console.log(fixed === 0 && problems === 0 ? 'nothing needed fixing' : `${fixed} repaired, ${problems} removed`);
process.exit(0);
