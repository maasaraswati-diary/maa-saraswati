/**
 * One-off: pad the already-uploaded product photos to a square.
 *
 * `optimiseImage` in src/lib/imageOptimiser.js now pads every picture to 1:1
 * before it is stored, because the product card and the product page both fill
 * a square frame edge to edge and would otherwise cut the sides off. Photos
 * uploaded before that change are still stored at whatever shape they were
 * taken in, so this brings them in line with what the code now produces.
 *
 * Each stored picture is padded around its own long edge and re-encoded, so a
 * thumbnail stays a thumbnail and the large one stays large.
 *
 *   node scripts/pad-existing-uploads.mjs
 */
import sharp from 'sharp';
import {
  initializeApp,
  cert,
} from '../../server/node_modules/firebase-admin/app/index.js';
import { getFirestore } from '../../server/node_modules/firebase-admin/firestore/index.js';
import { readFileSync } from 'node:fs';

const CREDENTIALS =
  'E:/Diary/maa-saraswati-diary-firebase-adminsdk-fbsvc-d817071b83.json';

/** Matches PAD_BACKGROUND in src/lib/imageOptimiser.js. */
const PAD_BACKGROUND = '#ffffff';

/** Matches QUALITY there too, so re-encoded pictures look like new ones. */
const QUALITY = 72;

const key = JSON.parse(readFileSync(CREDENTIALS, 'utf8'));
initializeApp({ credential: cert(key), projectId: key.project_id });
const db = getFirestore();

/** Centre the picture on a square of its own long edge, on a white ground. */
async function toSquare(buffer) {
  const meta = await sharp(buffer).metadata();
  const square = Math.max(meta.width, meta.height);
  if (meta.width === meta.height) {
    return { buffer, square, changed: false };
  }
  const left = Math.round((square - meta.width) / 2);
  const top = Math.round((square - meta.height) / 2);
  const out = await sharp({
    create: {
      width: square,
      height: square,
      channels: 3,
      background: PAD_BACKGROUND,
    },
  })
    .composite([{ input: buffer, left, top }])
    .webp({ quality: QUALITY })
    .toBuffer();
  return { buffer: out, square, changed: true };
}

const snap = await db.collection('uploads').get();
let touched = 0;

for (const d of snap.docs) {
  const f = d.data();
  const large = Buffer.from(f.large, 'base64');
  const thumb = f.thumb ? Buffer.from(f.thumb, 'base64') : null;

  const a = await toSquare(large);
  const b = thumb ? await toSquare(thumb) : null;

  if (!a.changed && (!b || !b.changed)) {
    console.log(`  ${d.id}: already square, left alone`);
    continue;
  }

  const largeB64 = a.buffer.toString('base64');
  await d.ref.set(
    {
      large: largeB64,
      thumb: b ? b.buffer.toString('base64') : f.thumb,
      width: a.square,
      height: a.square,
      // Same estimate the browser records, so the two agree.
      bytes: Math.round(largeB64.length * 0.75),
    },
    { merge: true }
  );
  touched += 1;
  console.log(
    `  ${d.id}: ${a.changed ? 'large' : 'large ok'}` +
      `${b ? `, thumb ${b.changed ? 'padded' : 'ok'}` : ''}` +
      ` -> ${a.square}x${a.square}` +
      `  (${Math.round(largeB64.length * 0.75 / 1024)} KB)`
  );
}

console.log(`\n${touched} of ${snap.size} upload(s) padded to square`);
process.exit(0);
