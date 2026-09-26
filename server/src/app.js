import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';

import productsRouter from './routes/products.js';
import enquiriesRouter from './routes/enquiries.js';
import adminRouter from './routes/admin.js';
import { readCollection, writeCollection, backendName } from './storage/index.js';
import { streamUpload } from './storage/uploads.js';

/**
 * The Express app, kept separate from the process entry point so the exact
 * same app can run locally (`src/index.js`) and inside a Cloud Function
 * (`src/functions.js`).
 */

/**
 * Allowed browser origins. On Firebase Hosting the site and the API share an
 * origin (hosting rewrites /api to this function), but the function URL can
 * also be called directly, so both are permitted.
 */
const ORIGINS = (process.env.CLIENT_ORIGIN || 'http://localhost:5180')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const isFirebaseHost = (origin) =>
  typeof origin === 'string' &&
  (origin.endsWith('.web.app') || origin.endsWith('.firebaseapp.com'));

export const app = express();

app.set('trust proxy', 1);

app.use(
  helmet({
    // Product images are served to the browser from a different bucket/host.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  })
);

app.use(
  cors({
    origin(origin, cb) {
      // Same-origin requests and curl/Postman send no Origin header.
      if (!origin || ORIGINS.includes(origin) || isFirebaseHost(origin)) {
        return cb(null, true);
      }
      return cb(new Error('Not allowed by CORS'));
    },
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Product images. Locally these are plain files; when deployed they are read
// back out of Cloud Storage, so the /uploads/<file> URL works either way.
app.get('/uploads/:filename', async (req, res) => {
  const served = await streamUpload(req.params.filename, res).catch(() => false);
  if (!served && !res.headersSent) {
    res.status(404).json({ error: 'Image not found.' });
  }
});

// API routes
app.use('/api/products', productsRouter);
app.use('/api/enquiries', enquiriesRouter);
app.use('/api/admin', adminRouter);

/**
 * True when the host gives us a throwaway disk, so files written to
 * server/uploads disappear on restart. Render's free tier, Railway, Fly and
 * every Cloud Functions runtime behave this way.
 */
const EPHEMERAL_HOSTS = ['RENDER', 'RAILWAY_ENVIRONMENT', 'FLY_APP_NAME', 'K_SERVICE'];
const uploadsAreEphemeral = EPHEMERAL_HOSTS.some((k) => Boolean(process.env[k]));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'maa-saraswati-api',
    storage: backendName,
    uploads: uploadsAreEphemeral ? 'ephemeral' : 'persistent',
  });
});

// 404 for unknown API routes
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// Central error handler
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Something went wrong on our side.' : err.message,
  });
});

/** Creates the default admin account the first time the app boots. */
export async function ensureAdminUser() {
  const email = (
    process.env.ADMIN_EMAIL || 'maasaraswati449@gmail.com'
  ).toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  const users = await readCollection('users');
  if (users.some((u) => String(u.email).toLowerCase() === email)) return;

  users.push({
    id: 'usr_admin',
    name: 'Site Administrator',
    email,
    role: 'admin',
    passwordHash: await bcrypt.hash(password, 10),
    createdAt: new Date().toISOString(),
  });
  await writeCollection('users', users);
  console.log(`[auth] admin account ready for ${email}`);
}
