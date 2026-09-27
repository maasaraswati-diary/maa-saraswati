/**
 * The films, in R2.
 *
 * Everything about the video page lives in one small bucket:
 *
 *   videos/<name>.mp4    the film itself
 *   posters/<name>.jpg   the frame shown before anybody presses play
 *   videos/index.json    title, note and order - the list the page draws
 *
 * The index is a plain file rather than a database row because there is only
 * ever one author and a handful of films, and because a file next to the thing
 * it describes cannot fall out of step with it. Firestore was the other option
 * and was ruled out for a plain reason: its security rules would have needed
 * changing, and that means opening the Firebase console by hand every time a
 * collection is added.
 */

/** Where the list of films is kept. */
export const INDEX_KEY = 'videos/index.json';

/**
 * The largest film that will be accepted, in bytes.
 *
 * The panel sends the file inside a JSON body, which base64 encoding inflates by
 * a third, and it all has to sit in memory while it is written. 25 MB leaves
 * comfortable room inside a free plan's limits and is several times bigger than
 * the shop's existing films.
 */
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

/** A poster frame is a small picture; anything bigger is a mistake. */
export const MAX_POSTER_BYTES = 2 * 1024 * 1024;

/**
 * Is the bucket actually bound?
 *
 * R2 has to be switched on in the Cloudflare dashboard before it can be bound,
 * and until that is done the site still works - the video page falls back to
 * the films shipped with the build. Saying so plainly beats a 500.
 */
export function bucketAvailable(env) {
  return Boolean(env?.VIDEOS && typeof env.VIDEOS.get === 'function');
}

/**
 * A name is only ever letters, digits and dashes.
 *
 * The name becomes part of a path in the bucket and is echoed back into a URL,
 * so anything that could reach outside its own folder - slashes, dots, spaces -
 * is refused rather than tidied up. Tidying is how a surprising name turns into
 * somebody else's file.
 */
export function isSafeKey(key) {
  return typeof key === 'string' && /^[a-z0-9][a-z0-9-]{0,59}$/.test(key);
}

/** Turn a title into something that can be a file name. */
export function slugify(text) {
  const base = String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'video';
}

/** A name not already taken, by putting a number on the end. */
export function uniqueKey(wanted, taken) {
  if (!taken.includes(wanted)) return wanted;
  for (let n = 2; n < 200; n += 1) {
    const candidate = `${wanted}-${n}`;
    if (!taken.includes(candidate)) return candidate;
  }
  return `${wanted}-${Date.now()}`;
}

/** Read the list of films. A missing or damaged file reads as no films. */
export async function readIndex(env) {
  const stored = await env.VIDEOS.get(INDEX_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(await stored.text());
    const list = Array.isArray(parsed) ? parsed : parsed?.videos;
    return Array.isArray(list) ? list.filter((v) => v && isSafeKey(v.key)) : [];
  } catch {
    // A corrupt index is recoverable - the files are untouched and the owner can
    // re-add from the panel. Refusing to read it would leave no way back.
    return [];
  }
}

/** Write the list of films back. */
export async function writeIndex(env, videos) {
  await env.VIDEOS.put(INDEX_KEY, JSON.stringify({ videos }, null, 2), {
    httpMetadata: { contentType: 'application/json', cacheControl: 'no-store' },
  });
}

/** What the public page is given: never the bucket key, only a path to fetch. */
export function publicVideo(entry) {
  return {
    slug: entry.key,
    title: entry.title || entry.key,
    note: entry.note || '',
    // The file's own name, extension and all. The serving route only hands over
    // a path that ends in a real extension, so the name has to be kept rather
    // than guessed at from the slug - the film and the poster do not always
    // come out as mp4 and jpg.
    src: entry.file ? `/media/${entry.file}` : '',
    poster: entry.posterFile ? `/media/${entry.posterFile}` : '',
    size: entry.size || 0,
    added: entry.added || '',
  };
}

/**
 * Turn a data: URL into the bytes it holds.
 *
 * The panel sends the file this way so that the film and its poster can travel
 * in a single request - a film must never appear on the site with no picture
 * waiting behind it, and two separate uploads cannot promise that.
 */
export function decodeDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return { mime: '', bytes: null };
  }
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return { mime: '', bytes: null };
  const meta = dataUrl.slice(5, comma);
  const mime = meta.split(';')[0].trim().toLowerCase();
  const body = dataUrl.slice(comma + 1);
  if (!meta.includes('base64')) {
    return { mime, bytes: new TextEncoder().encode(decodeURIComponent(body)).buffer };
  }
  try {
    const binary = atob(body);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return { mime, bytes: bytes.buffer };
  } catch {
    return { mime, bytes: null };
  }
}

/** A plain JSON answer, with the headers a browser needs to be told no. */
export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
