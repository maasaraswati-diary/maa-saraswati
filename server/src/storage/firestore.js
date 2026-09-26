/**
 * Firestore-backed storage.
 *
 * Same interface as the JSON store, so every route works unchanged:
 *   readCollection(name)       -> array of documents
 *   writeCollection(name, arr) -> replaces the collection
 *
 * The Admin SDK has no client-style helpers (no getDocs/setDoc/deleteDoc), so
 * everything goes through the instance returned by getFirestore().
 * Documents keep their `id` field as the Firestore document id, which keeps
 * the data portable between this backend and the JSON files.
 *
 * Credentials come from whichever source is available:
 *   FIREBASE_SERVICE_ACCOUNT  JSON of a service account key (Render, any host)
 *   Application Default Credentials (Cloud Functions, emulators, gcloud)
 */
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

let db = null;
let appReady = false;

function ensureApp() {
  if (appReady) return;
  appReady = true;

  if (getApps().length > 0) return;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    // The whole key pasted into one env var, which is what Render and most
    // hosts make easiest. Tolerates base64 or raw JSON.
    let json = raw;
    if (!/^\s*\{/.test(raw)) {
      json = Buffer.from(raw, 'base64').toString('utf8');
    }
    initializeApp({
      credential: cert(JSON.parse(json)),
      projectId: process.env.FIRESTORE_PROJECT_ID || undefined,
    });
    console.log('[firestore] initialised from FIREBASE_SERVICE_ACCOUNT');
    return;
  }

  initializeApp();
  console.log('[firestore] initialised with application default credentials');
}

function firestore() {
  if (!db) {
    ensureApp();
    db = getFirestore();
    // Rejecting undefined fields keeps route code simple: an omitted property
    // is treated as "not set" instead of throwing.
    db.settings({ ignoreUndefinedProperties: true });
  }
  return db;
}

export async function readCollection(name) {
  const snap = await firestore().collection(name).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) =>
      String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
    );
}

export async function writeCollection(name, value) {
  const store = firestore();
  const col = store.collection(name);
  const live = await col.get();
  const keep = new Set(value.map((v) => String(v.id)));

  // Firestore batches cap at 500 operations, so queue and flush in blocks.
  const batches = [];
  let batch = store.batch();
  let pending = 0;

  const flush = () => {
    if (pending === 0) return;
    batches.push(batch);
    batch = store.batch();
    pending = 0;
  };

  for (const item of value) {
    batch.set(col.doc(String(item.id)), item);
    if (++pending >= 400) flush();
  }
  for (const d of live.docs) {
    if (!keep.has(d.id)) batch.delete(d.ref);
    if (++pending >= 400) flush();
  }
  flush();

  for (const b of batches) await b.commit();
  return value;
}

export const backend = 'firestore';
