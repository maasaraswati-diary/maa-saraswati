/**
 * Seeds a live Firestore database with the starter catalogue and the admin
 * account. Safe to run more than once: anything already present is left alone.
 *
 *   node scripts/seed-firestore.mjs [path-to-service-account.json]
 *
 * Reads FIREBASE_SERVICE_ACCOUNT from the environment when no path is given.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.join(__dirname, '..');

/* ----------------------------------------------------------- credentials */

function loadCredentials() {
  const argPath = process.argv[2];
  const raw = argPath ? fs.readFileSync(argPath, 'utf8') : process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!raw) {
    console.error(
      'No credentials.\n' +
        'Pass a key file:  node scripts/seed-firestore.mjs ./my-key.json\n' +
        'or set FIREBASE_SERVICE_ACCOUNT to the key JSON / base64.'
    );
    process.exit(1);
  }

  let json = raw;
  if (!/^\s*\{/.test(json)) json = Buffer.from(json, 'base64').toString('utf8');
  const key = JSON.parse(json);
  if (key.type !== 'service_account' || !key.private_key) {
    console.error('That file is not a Firebase service-account key.');
    process.exit(1);
  }
  return key;
}

/* ---------------------------------------------------------------- helpers */

const newId = (p) => `${p}_${crypto.randomBytes(6).toString('hex')}`;
const nowIso = () => new Date().toISOString();

const key = loadCredentials();
initializeApp({ credential: cert(key), projectId: key.project_id });
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

const readSeed = (name) => {
  const file = path.join(SERVER, 'seed', `${name}.json`);
  if (!fs.existsSync(file)) return [];
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Array.isArray(parsed) ? parsed : [];
};

const writeAll = async (name, rows) => {
  const col = db.collection(name);
  let batch = db.batch();
  let n = 0;
  const flush = async () => {
    if (n) {
      await batch.commit();
      batch = db.batch();
      n = 0;
    }
  };
  for (const row of rows) {
    batch.set(col.doc(String(row.id)), row);
    if (++n >= 400) await flush();
  }
  await flush();
};

async function seedProducts() {
  const live = await db.collection('products').get();
  if (!live.empty && !process.argv.includes('--force')) {
    console.log(`products: already has ${live.size} document(s) - left untouched`);
    return;
  }
  const rows = readSeed('products');
  if (!rows.length) {
    console.log('products: no seed file found - skipped');
    return;
  }
  const col = db.collection('products');
  for (const p of rows) await col.doc(String(p.id)).set(p);
  console.log(`products: wrote ${rows.length} starter products`);
}

async function seedEnquiries() {
  const live = await db.collection('enquiries').get();
  if (!live.empty) {
    console.log(`enquiries: already has ${live.size} document(s) - left untouched`);
    return;
  }
  const rows = readSeed('enquiries');
  if (!rows.length) {
    console.log('enquiries: no seed file found - skipped');
    return;
  }
  const col = db.collection('enquiries');
  for (const e of rows) await col.doc(String(e.id)).set(e);
  console.log(`enquiries: wrote ${rows.length}`);
}

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'maasaraswati449@gmail.com').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  const existing = await db.collection('users').where('email', '==', email).limit(1).get();
  if (!existing.empty) {
    console.log(`admin: ${email} already exists - left untouched`);
    return;
  }

  await db.collection('users').doc('usr_admin').set({
    id: 'usr_admin',
    name: 'Site Administrator',
    email,
    role: 'admin',
    passwordHash: await bcrypt.hash(password, 10),
    createdAt: nowIso(),
  });
  console.log(`admin: created account for ${email}`);
}

/* ------------------------------------------------------------------- run */

console.log(`\nSeeding Firestore project "${key.project_id}"\n`);
await seedProducts();
await seedEnquiries();
await seedAdmin();

const products = await db.collection('products').get();
const users = await db.collection('users').get();
console.log(`\nDone. products=${products.size}  users=${users.size}\n`);
process.exit(0);
