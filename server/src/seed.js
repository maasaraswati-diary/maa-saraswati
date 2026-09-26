/**
 * First-run seeding.
 *
 * A freshly created Firestore database has no documents, so the deployed site
 * would show an empty catalogue until someone added products by hand. Instead,
 * the starter catalogue ships with the code and is written to the database the
 * first time the app boots against an empty collection.
 *
 * Seeding only ever *adds* - if a collection already has documents it is left
 * completely untouched, so edits made from the admin panel are never lost.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCollection, writeCollection, backendName } from './storage/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DIR = path.join(__dirname, '..', 'seed');

async function readSeed(name) {
  const file = path.join(SEED_DIR, `${name}.json`);
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

/**
 * Copies any missing seed collection into storage.
 * @returns {Promise<{products:number, enquiries:number}>} counts written
 */
export async function seedIfEmpty() {
  const written = { products: 0, enquiries: 0 };

  if (backendName !== 'firestore') return written;

  for (const name of ['products', 'enquiries']) {
    const existing = await readCollection(name);
    if (existing.length > 0) continue;

    const seed = await readSeed(name);
    if (seed.length === 0) continue;

    await writeCollection(name, seed);
    written[name] = seed.length;
    console.log(`[seed] ${name}: wrote ${seed.length} starter documents`);
  }

  return written;
}

// Allow running directly: `node src/seed.js`
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  seedIfEmpty()
    .then((r) => {
      console.log('[seed] done', r);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[seed] failed:', err);
      process.exit(1);
    });
}
