/**
 * Image storage.
 *
 * Locally, files go to `server/uploads`. On Cloud Functions the disk is
 * temporary, so uploads go to the project's Cloud Storage bucket instead and
 * downloads are streamed back through the API.
 *
 * The URL contract is identical either way (`/uploads/<file>`), so the frontend
 * never needs to know which backend is in play.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

let bucket = null;
let bucketChecked = false;

/** Returns the default Cloud Storage bucket, or null when unavailable. */
async function getBucket() {
  if (bucketChecked) return bucket;
  bucketChecked = true;
  try {
    // firebase-admin is only present in the deployed function.
    const { getStorage } = await import('firebase-admin/storage');
    const { initializeApp, getApps } = await import('firebase-admin/app');
    if (getApps().length === 0) initializeApp();
    bucket = getStorage().bucket();
    console.log('[uploads] using Cloud Storage bucket', bucket.name);
  } catch (err) {
    console.log('[uploads] using local disk (no Cloud Storage available)');
    bucket = null;
  }
  return bucket;
}

const CONTENT_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
};

/** Saves a multer temp file and returns the public URL. */
export async function saveUpload(file) {
  const filename = file.filename;
  const contentType = CONTENT_TYPES[path.extname(filename).toLowerCase()]
    || file.mimetype
    || 'application/octet-stream';

  const b = await getBucket();
  if (b) {
    await b.file(`uploads/${filename}`).save(file.path, {
      contentType,
      resumable: false,
      metadata: { cacheControl: 'public, max-age=31536000, immutable' },
    });
    await fs.rm(file.path, { force: true }).catch(() => {});
    return `/uploads/${filename}`;
  }

  // Local disk: move the temp file into the uploads folder.
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.rename(file.path, path.join(UPLOAD_DIR, filename));
  return `/uploads/${filename}`;
}

/**
 * Streams a stored image back to the browser.
 * Falls back to the local uploads folder when there is no bucket.
 */
export async function streamUpload(filename, res) {
  const b = await getBucket();

  if (b) {
    const remote = b.file(`uploads/${path.basename(filename)}`);
    const [exists] = await remote.exists();
    if (!exists) return false;
    const [meta] = await remote.getMetadata();
    res.setHeader('Content-Type', meta.contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    Readable.fromWebStream(
      (await remote.createReadStream({ version: 'v1' })) || []
    ).pipe(res);
    return true;
  }

  const local = path.join(UPLOAD_DIR, path.basename(filename));
  try {
    const data = await fs.readFile(local);
    res.setHeader(
      'Content-Type',
      CONTENT_TYPES[path.extname(local).toLowerCase()] || 'application/octet-stream'
    );
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.end(data);
    return true;
  } catch {
    return false;
  }
}
