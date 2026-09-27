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
 * before the first removal and put that film back on the page. The list went to
 * Firestore, which is strongly consistent and already holds the catalogue.
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
export const INDEX_DOC = INDEX.doc;

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

/** The key the read-through mirror of the list is kept under. */
const MIRROR_KEY = 'list-mirror';

/**
 * The list, read from the mirror and kept honest in the background.
 *
 * A read of Firestore failed once and blanked the owner's video page: the
 * function treated "could not read it" as "there is nothing there", and a
 * hiccup at Google emptied a page for everybody. An empty list and a failed
 * read are different answers and only one of them may be given.
 *
 * So the list is mirrored in KV, which is a read away and answers every time,
 * and Firestore stays the truth it is written to. A visitor's read is answered
 * from the mirror and refreshes it in the background, so a stale mirror corrects
 * itself without anyone waiting for it, and no visit spends a Firestore read.
 *
 * `fresh` skips the mirror and goes to the truth. The panel uses it: the owner
 * has just pressed a button, and being shown a list that does not yet include
 * what they just did is worse than a slower answer. It is also not worth
 * optimising - one person, a few seconds.
 *
 * Throws if the truth cannot be reached. It must: a caller that is told "there
 * is nothing here" when the answer is "I could not look" will empty the page,
 * and an owner watching that believes their films are gone.
 */
export async function listFilms(env, ctx, { fresh = false } = {}) {
  if (fresh) {
    const truth = await firestoreList();
    if (truth === null) {
      throw new Error('The list of films could not be read just now. Please try again.');
    }
    if (ctx?.waitUntil) ctx.waitUntil(writeMirror(env, truth));
    return truth;
  }
  let mirror = null;
  try {
    mirror = await env.VIDEOS.get(MIRROR_KEY, 'json');
  } catch {
    mirror = null;
  }
  if (Array.isArray(mirror)) {
    const pending = firestoreList();
    if (ctx?.waitUntil) ctx.waitUntil(refresh(env, pending));
    return mirror.filter((v) => v && isSafeKey(v.key));
  }
  // No mirror yet, or it could not be read: go to the truth, and only say
  // "nothing" if the truth actually says so.
  const first = await firestoreList();
  if (first === null) {
    throw new Error('The list of films could not be read just now. Please try again.');
  }
  if (ctx?.waitUntil) ctx.waitUntil(writeMirror(env, first));
  return first;
}

/** Bring the mirror back in line with the truth. */
async function refresh(env, pending) {
  try {
    const truth = await pending;
    if (Array.isArray(truth)) await writeMirror(env, truth);
  } catch {
    // Nothing to do: the next read tries again.
  }
}

/** Write the mirror. Failing to write it costs a slower read, nothing more. */
export async function writeMirror(env, videos) {
  await env.VIDEOS.put(MIRROR_KEY, JSON.stringify(videos)).catch(() => {});
}

/**
 * Every film actually in the store, by name.
 *
 * A KV list call returns names only - it does not read the films - so this is one
 * cheap read however many films there are.
 */
export async function storedFilmNames(env) {
  const names = new Set();
  let cursor;
  do {
    const page = await env.VIDEOS.list({ prefix: 'film:', limit: 1000, cursor });
    for (const k of page?.keys || []) names.add(k.name.slice('film:'.length));
    cursor = page?.list_complete ? undefined : page?.cursor;
  } while (cursor);
  return names;
}

/**
 * How long a film is left alone before it is checked for.
 *
 * A KV listing is eventually consistent just as a read is, so a film that was
 * stored a moment ago may not appear in one yet. Filtering on that basis hid
 * every newly uploaded film for a minute or two, which looked exactly like the
 * upload having failed. A film younger than this is taken on trust; an older one
 * is checked.
 */
const VERIFY_AFTER_MS = 5 * 60 * 1000;

/**
 * Drop films from the list whose film is not there.
 *
 * The list is derived from the store, so the store is the truth. An entry whose
 * film has gone would draw a card that plays nothing, and that is the one
 * failure a customer notices and blames the shop for - worse than a film simply
 * not being on the page.
 *
 * Only films old enough to have settled are checked. In practice the ordering
 * already prevents a name without a film: a film is stored before it is listed,
 * and unlisted before it is removed, so this catches the leftovers of an earlier
 * mistake rather than waiting for a new one.
 */
export async function onlyFilmsThatExist(env, videos) {
  const now = Date.now();
  // An entry with no usable date is left alone. It cannot be judged old enough
  // to check, and an entry too new to check is safer than one wrongly judged.
  const settled = videos.filter((v) => {
    const added = Date.parse(v.added);
    return Number.isFinite(added) && now - added > VERIFY_AFTER_MS;
  });
  if (!settled.length) return videos;
  try {
    const have = await storedFilmNames(env);
    const gone = new Set(settled.filter((v) => !have.has(v.key)).map((v) => v.key));
    return gone.size ? videos.filter((v) => !gone.has(v.key)) : videos;
  } catch {
    // If the store cannot be asked, the list stands. Showing a card that might
    // not play is better than emptying the page over a transient failure.
    return videos;
  }
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
 * The mirror is written afterwards, not instead. It is only a copy: a write that
 * reached Firestore and failed to reach the copy leaves the page showing the
 * previous list for a moment, which the next read corrects. The reverse - a copy
 * written and the truth not - would lose the change.
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
  await writeMirror(env, videos);
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
    // A film the list holds whose file has gone. Shown to the owner so it can be
    // removed; never shown to a visitor.
    missing: Boolean(entry.missing),
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
