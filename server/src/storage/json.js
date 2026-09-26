import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to the `server/data` folder. */
export const DATA_DIR = path.join(__dirname, '..', '..', 'data');

const cache = new Map();

/**
 * Reads a JSON collection from disk, returning [] when the file is missing.
 * Results are cached in memory (writes invalidate the cache) so repeated reads
 * stay fast without pulling in a database.
 */
export async function readCollection(name) {
  if (cache.has(name)) return cache.get(name);

  const file = path.join(DATA_DIR, `${name}.json`);
  try {
    const raw = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(raw);
    const value = Array.isArray(parsed) ? parsed : [];
    cache.set(name, value);
    return value;
  } catch (err) {
    if (err.code === 'ENOENT') {
      await writeCollection(name, []);
      const empty = [];
      cache.set(name, empty);
      return empty;
    }
    console.error(`[json] failed to read ${name}.json:`, err.message);
    throw err;
  }
}

/**
 * Atomically writes a collection back to disk and refreshes the cache.
 *
 * The write goes to a temp file first, then a rename swaps it in, so a crash
 * mid-write can never leave a half-written file behind. On Windows that rename
 * can fail transiently with EPERM/EBUSY when antivirus, Search, or another
 * handle touches the file, so we retry briefly before giving up.
 */
export async function writeCollection(name, value) {
  const file = path.join(DATA_DIR, `${name}.json`);
  const tmp = `${file}.${process.pid}.tmp`;
  const json = JSON.stringify(value, null, 2);

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(tmp, json, 'utf8');

  const RETRIES = 5;
  for (let attempt = 1; ; attempt++) {
    try {
      await fs.rename(tmp, file);
      break;
    } catch (err) {
      const retryable = err.code === 'EPERM' || err.code === 'EBUSY';
      if (!retryable || attempt >= RETRIES) {
        await fs.rm(tmp, { force: true }).catch(() => {});
        throw err;
      }
      await new Promise((r) => setTimeout(r, 40 * attempt));
    }
  }

  cache.set(name, value);
  return value;
}

export const backend = 'json';
