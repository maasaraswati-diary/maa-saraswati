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
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

// Firebase console -> Project settings -> General -> Your apps -> Web
const firebaseConfig = {
  apiKey: 'AIzaSyDnrPsWBJNpNV35VJ0yJ5phognup1QC73Y',
  authDomain: 'maa-saraswati-diary.firebaseapp.com',
  projectId: 'maa-saraswati-diary',
  storageBucket: 'maa-saraswati-diary.firebasestorage.app',
  messagingSenderId: '708736705937',
  appId: '1:708736705937:web:0865d378c5ab7a1ffe2630',
};

export const isFirebaseConfigured = !Object.values(firebaseConfig).some(
  (v) => typeof v === 'string' && v.startsWith('PASTE_')
);

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Cache reads so repeat visits are instant, even on a slow connection.
export const db = isFirebaseConfigured
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    })
  : null;

export const auth = isFirebaseConfigured ? getAuth(app) : null;

if (auth) {
  // Keep the user signed in between visits.
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}

export default app;
