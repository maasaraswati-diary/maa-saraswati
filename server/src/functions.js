/**
 * Cloud Function entry point.
 *
 * Wraps the same Express app used in local development. Firebase Hosting
 * rewrites /api/** to this function (see firebase.json), so the browser talks
 * to a single origin and CORS never comes into play.
 *
 * Region is pinned to Mumbai (asia-south1) to keep latency low for the shop.
 */
import { setGlobalOptions } from 'firebase-functions/v2';
import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { app, ensureAdminUser } from './app.js';
import { seedIfEmpty } from './seed.js';

initializeApp();

setGlobalOptions({ region: 'asia-south1', maxInstances: 10 });

/**
 * Runs once per cold start: makes sure the admin account exists and that a
 * brand-new Firestore database is filled with the starter catalogue.
 */
let ready = null;
function warmUp() {
  if (!ready) {
    ready = (async () => {
      await seedIfEmpty();
      await ensureAdminUser();
    })().catch((err) => {
      console.error('[warmup] failed:', err);
      ready = null;
    });
  }
  return ready;
}

export const api = onRequest(
  {
    // Public site + admin panel; tighten with App Check before going live.
    invoker: 'public',
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (req, res) => {
    try {
      await warmUp();
    } catch {
      /* warm-up problems must not block requests */
    }
    return app(req, res);
  }
);
