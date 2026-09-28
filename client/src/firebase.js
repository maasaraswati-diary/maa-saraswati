/**
 * Firebase setup for the browser.
 *
 * The admin/partner panel talks to Firestore directly from the browser, so no
 * application server is required for it to work. Authentication uses Firebase
 * email/password, and Firestore security rules decide who may read and write.
 *
 * The config below is PUBLIC information - it ships inside the JavaScript
 * bundle and is not a secret. Only the security rules protect the data.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase console -> Project settings -> General -> Your apps -> Web
const firebaseConfig = {
  apiKey: 'AIzaSyDnrPsWBJNpNV35VJ0yJ5phognup1QC73Y',
  authDomain: 'maa-saraswati-diary.firebaseapp.com',
  projectId: 'maa-saraswati-diary',
  storageBucket: 'maa-saraswati-diary.firebasestorage.app',
  messagingSenderId: '708736705937',
  appId: '1:708736705937:web:0865d378c5ab7a1ffe2630',
};

/**
 * Build the shop as a plain static site: no Firebase, the catalogue served
 * entirely from the build-time snapshot, and not one request to any project.
 *
 * This is what the tests run against. They need a storefront they can put a
 * product into - an unpriced one, in this case - and the only honest way to get
 * that is to answer from data the test itself wrote, rather than saving a test
 * product to the owner's live catalogue while the owner is using the panel. A
 * network cut does not do it: the Firestore SDK sends its reads over a
 * long-lived connection and retries it, so the page hangs on "0 products"
 * instead of falling back.
 *
 * Set with:  VITE_STATIC_ONLY=1 npm run build
 * Unset, it is the real project. That is the default and what is deployed.
 */
const STATIC_ONLY = import.meta.env?.VITE_STATIC_ONLY === '1';

export const isFirebaseConfigured = !STATIC_ONLY && !Object.values(firebaseConfig).some(
  (v) => typeof v === 'string' && v.startsWith('PASTE_')
);

// Guarded, because initializeApp with nothing to initialise throws - and
// `isFirebaseConfigured` already existed to describe a shop with no project,
// which could not actually be built until this line agreed with it.
const app = isFirebaseConfigured
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null;

// Firestore is read straight from the server on every visit, using the SDK's
// default in-memory cache. An on-disk cache is deliberately avoided: a product
// the owner has just approved must show up for customers immediately, and a
// stale cached catalogue is worse than a marginally slower one.
export const db = isFirebaseConfigured ? getFirestore(app) : null;

export const auth = isFirebaseConfigured ? getAuth(app) : null;

if (auth) {
  // Keep the user signed in between visits.
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}

export default app;
