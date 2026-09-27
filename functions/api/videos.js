/**
 * The video page's back end.
 *
 * GET    /api/videos   the list of films, for the public page
 * POST   /api/videos   add a film          (owner only)
 * PUT    /api/videos   change a film's details, or the order they appear in
 * DELETE /api/videos?key=...  remove a film
 *
 * The film itself goes into Workers KV; the list of films goes into Firestore.
 * Anything that changes something checks who is asking first - see _lib/auth.js
 * - and Firestore's own rules check the write a second time, on its own account.
 */
import { isOwner } from '../_lib/auth.js';
import {
  MAX_POSTER_BYTES,
  MAX_VIDEO_BYTES,
  bearerToken,
  decodeDataUrl,
  filmKey,
  isSafeKey,
  json,
  listFilms,
  onlyFilmsThatExist,
  posterKey,
  publicVideo,
  readIndex,
  slugify,
  storageAvailable,
  storedFilmNames,
  uniqueKey,
  writeIndex,
} from '../_lib/videos.js';

/**
 * The list of films.
 *
 * A visitor gets only the films that can actually be played. The panel asks for
 * `?fresh=1` and gets everything the list holds, including a film whose file has
 * gone - marked rather than hidden. Hiding it from the panel would leave the
 * owner with something they can neither see nor remove, and a page they cannot
 * clear.
 */
export async function onRequestGet({ request, env, waitUntil }) {
  if (!storageAvailable(env)) return json({ available: false, videos: [] });
  const fresh = new URL(request.url).searchParams.get('fresh') === '1';

  let videos;
  try {
    videos = await listFilms(env, { waitUntil }, { fresh });
  } catch (err) {
    // Said plainly rather than answered with an empty list. An empty list is a
    // thing the owner acts on - they take films down, or believe they are gone.
    return json({ error: err?.message || 'The list of films could not be read.' }, 503);
  }

  if (!fresh) {
    // Only what can actually be played. See onlyFilmsThatExist.
    return json({ available: true, videos: (await onlyFilmsThatExist(env, videos)).map(publicVideo) });
  }

  let have = null;
  try {
    have = await storedFilmNames(env);
  } catch {
    have = null;
  }
  const marked = have
    ? videos.map((v) => (have.has(v.key) ? v : { ...v, missing: true }))
    : videos;
  return json({ available: true, videos: marked.map(publicVideo) });
}

/** Add a film. */
export async function onRequestPost({ request, env }) {
  const who = await isOwner(request, env);
  if (!who.ok) return json({ error: who.reason }, who.status);

  if (!storageAvailable(env)) {
    return json(
      { error: 'Video storage is not available. Please tell whoever looks after the website.' },
      503
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'The upload did not arrive intact. Please try again.' }, 400);
  }

  const title = String(body?.title || '').trim().slice(0, 80);
  const note = String(body?.note || '').trim().slice(0, 200);
  if (!title) return json({ error: 'Please give the film a title.' }, 400);

  const film = decodeDataUrl(body?.file);
  if (!film.bytes) return json({ error: 'No film was received. Please choose a file.' }, 400);
  if (!film.mime.startsWith('video/')) {
    return json({ error: 'That file is not a video. Please choose an MP4 or WebM file.' }, 400);
  }
  if (film.bytes.byteLength > MAX_VIDEO_BYTES) {
    return json(
      { error: `That film is ${mb(film.bytes.byteLength)} MB. The limit is ${mb(MAX_VIDEO_BYTES)} MB.` },
      413
    );
  }

  // Read through, and through the store, so that a name left behind by an
  // earlier failure is cleaned out of the list on the way past rather than
  // lingering in it.
  let existing;
  try {
    existing = await onlyFilmsThatExist(env, await readIndex());
  } catch (err) {
    // Refused rather than carried on with an empty list: the next write would
    // then be one that erases every other film.
    return json({ error: err?.message || 'The film could not be added.' }, 503);
  }
  const wanted = isSafeKey(body?.key) ? body.key : slugify(title);
  const key = uniqueKey(wanted, existing.map((v) => v.key));

  // The content type is kept with the film rather than worked out from its name
  // at serving time, so a film is always served as what it actually is.
  await env.VIDEOS.put(filmKey(key), film.bytes, {
    metadata: { contentType: film.mime, size: film.bytes.byteLength },
  });

  // The poster is optional. Without one the card still works - it falls back to
  // a plain panel - but a film with a picture behind it looks finished and one
  // without looks broken, so the panel always tries to send one.
  let posterFile = false;
  const frame = decodeDataUrl(body?.poster);
  if (frame.bytes && frame.mime.startsWith('image/') && frame.bytes.byteLength <= MAX_POSTER_BYTES) {
    posterFile = true;
    await env.VIDEOS.put(posterKey(key), frame.bytes, {
      metadata: { contentType: frame.mime, size: frame.bytes.byteLength },
    });
  }

  const entry = {
    key,
    title,
    note,
    posterFile,
    size: film.bytes.byteLength,
    added: new Date().toISOString(),
  };

  try {
    await writeIndex(env, [entry, ...existing], bearerToken(request));
  } catch (err) {
    // The film is stored but the page does not know about it. Taking it back out
    // leaves nothing half-done; leaving it would cost storage for a film nobody
    // can reach, and the next upload with the same title would be called "-2".
    await env.VIDEOS.delete(filmKey(key)).catch(() => {});
    await env.VIDEOS.delete(posterKey(key)).catch(() => {});
    return json({ error: err?.message || 'The film could not be added to the page.' }, 500);
  }

  return json({ ok: true, video: publicVideo(entry), total: existing.length + 1 }, 201);
}

/** Change a film's details, or move it up or down the page. */
export async function onRequestPut({ request, env }) {
  const who = await isOwner(request, env);
  if (!who.ok) return json({ error: who.reason }, who.status);
  if (!storageAvailable(env)) return json({ error: 'Video storage is not available.' }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'That did not arrive intact. Please try again.' }, 400);
  }

  let videos;
  try {
    videos = await readIndex();
  } catch (err) {
    return json({ error: err?.message || 'The list could not be read.' }, 503);
  }
  if (!videos.length) return json({ error: 'There are no films to change yet.' }, 400);

  let next;
  // Reordering. The panel sends the whole list of names in the order it wants,
  // which cannot go out of step with what is on screen.
  if (Array.isArray(body?.order)) {
    const byKey = new Map(videos.map((v) => [v.key, v]));
    const wanted = body.order.filter((k) => byKey.has(k));
    // Anything not named keeps its place at the end rather than disappearing.
    for (const v of videos) if (!wanted.includes(v.key)) wanted.push(v.key);
    next = wanted.map((k) => byKey.get(k));
  } else {
    const key = body?.key;
    if (!isSafeKey(key)) return json({ error: 'Which film?' }, 400);
    const at = videos.findIndex((v) => v.key === key);
    if (at < 0) return json({ error: 'That film is not on the page any more.' }, 404);

    next = videos.slice();
    if (body?.title !== undefined) {
      const title = String(body.title).trim().slice(0, 80);
      if (!title) return json({ error: 'A film needs a title.' }, 400);
      next[at].title = title;
    }
    if (body?.note !== undefined) {
      next[at].note = String(body.note).trim().slice(0, 200);
    }
  }

  try {
    await writeIndex(env, next, bearerToken(request));
  } catch (err) {
    return json({ error: err?.message || 'That change could not be saved.' }, 500);
  }
  return json({ ok: true, videos: next.map(publicVideo), video: publicVideo(next[0]) });
}

/** Remove a film, and its poster. */
export async function onRequestDelete({ request, env }) {
  const who = await isOwner(request, env);
  if (!who.ok) return json({ error: who.reason }, who.status);
  if (!storageAvailable(env)) return json({ error: 'Video storage is not available.' }, 503);

  const key = new URL(request.url).searchParams.get('key');
  if (!isSafeKey(key)) return json({ error: 'Which film?' }, 400);

  let videos;
  try {
    videos = await readIndex();
  } catch (err) {
    return json({ error: err?.message || 'The list could not be read.' }, 503);
  }
  const entry = videos.find((v) => v.key === key);
  if (!entry) return json({ error: 'That film is not on the page any more.' }, 404);

  const kept = videos.filter((v) => v.key !== key);
  try {
    await writeIndex(env, kept, bearerToken(request));
  } catch (err) {
    return json({ error: err?.message || 'That film could not be removed.' }, 500);
  }

  // The list is written first, and Firestore is read-your-writes, so the film is
  // off the page before anything else happens. Only then is the film itself
  // deleted - and if that part fails the worst case is a film costing a little
  // of the free allowance, rather than a page listing a film that plays nothing.
  await env.VIDEOS.delete(filmKey(key)).catch(() => {});
  await env.VIDEOS.delete(posterKey(key)).catch(() => {});

  return json({ ok: true, total: kept.length });
}

/** A megabyte count a person can read. */
function mb(bytes) {
  return Math.round(bytes / (1024 * 1024));
}
