/**
 * The films, in Workers KV.
 *
 * The films themselves are stored whole:
 *
 *   film:<name>      the film, as bytes
 *   poster:<name>    the frame shown before anybody presses play
 *
 * Why KV and not R2: R2 is the better store and was the first choice - it holds
 * any size and its reads cost nothing - but Cloudflare will not switch R2 on
 * until a card is on the account. A shop should not have to enter a card number
 * to change its own website, so this uses the store that is free without one.
 *
 * KV takes a single value of up to 25 MB, which is a whole film rather than a
 * piece of one, so a film is stored whole and reading it back costs one read.
 * The free allowance is 100,000 reads a day across everything.
 *
 * R2 can be swapped in later without touching anything above this file: the two
 * have the same four methods.
 *
 * The list of films is NOT kept here, and that was learned the hard way. It was,
 * and it lost films: KV reads are eventually consistent, so removing one film
 * and then removing another immediately afterwards could read the list as it was
 * before the first removal and put that film back on the page. It was also up to
 * a minute behind at the edge even when nothing was lost, so the owner who added
 * a film and went to look at it saw a page without it. The list went to
 * Firestore, which is strongly consistent, already holds the catalogue, and is
 * read straight through - there is no second copy anywhere.
 */

/** Where the list of films is kept - a single field in one Firestore document. */
const INDEX = {
  project: 'maa-saraswati-diary',
  doc: 'video-list',
  field: 'data',
  /**
   * Public. This ships inside the site's JavaScript bundle and is not a secret -
   * it only identifies the project. Firestore's security rules are what decide
   * whether a read is allowed, and the list is meant to be readable: the public
   * video page has to know which films there are.
   */
  apiKey: 'AIzaSyDnrPsWBJNpNV35VJ0yJ5phognup1QC73Y',
};

const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${INDEX.project}/databases/(default)/documents`;

/** The document holding the list, named so the catalogue can recognise it. */
/** The largest film that will be accepted, in bytes.
 *
 * KV's own limit is 25 MB, and the panel sends the file inside a JSON body which
 * base64 encoding inflates by a third, so it all has to sit in memory while it
 * is written. 20 MB leaves comfortable room and is many times bigger than any
 * film the shop has made - its own compress to well under a megabyte.
 */
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024;

/** A poster frame is a small picture; anything bigger is a mistake. */
export const MAX_POSTER_BYTES = 2 * 1024 * 1024;

/** Is the store actually bound? */
export function storageAvailable(env) {
  const store = env?.VIDEOS;
  return Boolean(store && typeof store.get === 'function' && typeof store.put === 'function');
}

/** The key a film is stored under. */
export const filmKey = (name) => `film:${name}`;

/** The key a poster frame is stored under. */
export const posterKey = (name) => `poster:${name}`;

/**
 * The list of films, read from Firestore.
 *
 * There was a copy of this kept in KV in front of Firestore, so that a visit to
 * the video page would not spend a read. That was a bad trade and it was
 * removed: the store's smallest possible staleness is a minute, so the owner who
 * added a film and went to look at it was shown a page without it, and the
 * figure it saved was nothing. A read of a document is a read, the daily
 * allowance is fifty thousand, and the video page is not the busiest thing on
 * this site by a long way. Correct and simple beats a minute of being wrong.
 *
 * Throws if the list cannot be read. It must: a caller that is told "there is
 * nothing here" when the answer is "I could not look" will empty the page, and
 * an owner watching that believes their films are gone.
 *
 * `fresh` is accepted and ignored. It asked for the truth rather than the copy;
 * now that there is only one answer, everything is it.
 */
export async function listFilms(env) {
  const truth = await firestoreList();
  if (truth === null) {
    throw new Error('The list of films could not be read just now. Please try again.');
  }
  return truth;
}

/** The list, from Firestore. Null means it could not be read - not that it is empty. */
async function firestoreList() {
  try {
    const res = await fetch(`${FIRESTORE}/shop/${INDEX.doc}?key=${encodeURIComponent(INDEX.apiKey)}`);
    if (res.status === 404) return [];
    if (!res.ok) return null;
    const raw = (await res.json())?.fields?.[INDEX.field]?.stringValue;
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((v) => v && isSafeKey(v.key)) : [];
  } catch {
    return null;
  }
}

/**
 * The list of films, read from Firestore for a change to be made to it.
 *
 * Throws if it cannot be read, and that is not a nicety. A change reads the
 * list, alters it and writes it back. A read that quietly answered "there is
 * nothing here" would turn the next write into one that erases every other film
 * - the owner's whole video page, gone because a request to Google failed once.
 * Not knowing is the only safe answer when a change depends on it.
 */
export async function readIndex() {
  const list = await firestoreList();
  if (list === null) {
    throw new Error(
      'The list of films could not be read, so nothing was changed. Please try again.'
    );
  }
  return list;
}

/**
 * Write the list of films back.
 *
 * The caller's own sign-in token is passed on, so Firestore's rules apply to this
 * write exactly as they would to one made from the browser: only the owner may
 * change it. The Functions add nothing to that and take nothing away - which is
 * the whole reason the list is written from here rather than by the Admin SDK.
 *
 */
export async function writeIndex(env, videos, token) {
  const url =
    `${FIRESTORE}/shop/${INDEX.doc}?key=${encodeURIComponent(INDEX.apiKey)}` +
    `&updateMask.fieldPaths=${INDEX.field}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fields: { [INDEX.field]: { stringValue: JSON.stringify(videos) } } }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    const said = detail?.error?.message || '';
    if (/PERMISSION_DENIED|Missing or insufficient permissions/i.test(said)) {
      throw new Error('Your sign-in has expired. Please sign in again and try once more.');
    }
    throw new Error(said || `The list of films could not be saved (${res.status}).`);
  }
}

/** The caller's sign-in token, taken from the request the endpoint was given. */
export function bearerToken(request) {
  const header = request?.headers?.get('Authorization') || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

/**
 * A name is only ever letters, digits and dashes.
 *
 * The name becomes part of a storage key and is echoed back into a URL, so
 * anything that could reach outside its own folder - slashes, dots, spaces - is
 * refused rather than tidied up. Tidying is how a surprising name turns into
 * somebody else's file.
 */
export function isSafeKey(key) {
  return typeof key === 'string' && /^[a-z0-9][a-z0-9-]{0,59}$/.test(key);
}

/** Turn a title into something that can be a name. */
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

/** What the public page is given: never a store key, only a path to fetch. */
export function publicVideo(entry) {
  return {
    slug: entry.key,
    title: entry.title || entry.key,
    note: entry.note || '',
    src: `/media/videos/${entry.key}`,
    poster: entry.posterFile ? `/media/posters/${entry.key}` : '',
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
