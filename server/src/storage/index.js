/**
 * Picks the storage backend at startup.
 *
 *   STORAGE=json       (default) local JSON files in server/data - zero setup
 *   STORAGE=firestore  Cloud Firestore - used once deployed to Firebase
 *
 * Auto-switches to Firestore when running inside Cloud Functions, so a missing
 * env var can never silently send production data to a temporary disk.
 *
 * Both backends are imported statically on purpose: the Cloud Functions loader
 * uses require(), which cannot handle an ESM graph containing top-level await,
 * so a dynamic `await import()` here would break the deployed function.
 */
import * as jsonBackend from './json.js';
import * as firestoreBackend from './firestore.js';

const useFirestore =
  process.env.STORAGE === 'firestore' ||
  Boolean(process.env.K_SERVICE) || // Cloud Functions runtime
  Boolean(process.env.FUNCTIONS_EMULATOR);

const backend = useFirestore ? firestoreBackend : jsonBackend;

console.log(`[storage] using ${backend.backend}`);

export const readCollection = backend.readCollection;
export const writeCollection = backend.writeCollection;
export const backendName = backend.backend;
export { newId, nowIso } from '../db.js';
