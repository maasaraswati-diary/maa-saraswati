/**
 * The video page's back end.
 *
 * GET    /api/videos   the list of films, for the public page
 * POST   /api/videos   add a film          (owner only)
 * PUT    /api/videos   change a film's details, or the order they appear in
 * DELETE /api/videos?key=...  remove a film
 *
 * Anything that changes something checks who is asking first - see _lib/auth.js.
 */
import { isOwner } from '../_lib/auth.js';
import {
  MAX_POSTER_BYTES,
  MAX_VIDEO_BYTES,
  bucketAvailable,
  decodeDataUrl,
  isSafeKey,
  json,
  publicVideo,
  readIndex,
  slugify,
  uniqueKey,
  writeIndex,
} from '../_lib/videos.js';

/** The public list. Cheap, and safe to ask for often. */
export async function onRequestGet({ env }) {
  if (!bucketAvailable(env)) {
    // The site is perfectly usable in this state - it falls back to the films
    // that were built into it. Saying so is more useful than an error.
    return json({ available: false, videos: [] });
  }
  const videos = await readIndex(env);
  return json({ available: true, videos: videos.map(publicVideo) });
}

/** Add a film. */
export async function onRequestPost({ request, env }) {
  const who = await isOwner(request, env);
  if (!who.ok) return json({ error: who.reason }, who.status);

  if (!bucketAvailable(env)) {
    return json(
      {
        error:
          'Video storage is not switched on yet. R2 has to be enabled in the Cloudflare dashboard before films can be uploaded.',
      },
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

  const extension = film.mime === 'video/webm' ? 'webm' : 'mp4';
  const existing = await readIndex(env);
  const wanted = isSafeKey(body?.key) ? body.key : slugify(title);
  const key = uniqueKey(wanted, existing.map((v) => v.key));

  await env.VIDEOS.put(`videos/${key}.${extension}`, film.bytes, {
    httpMetadata: {
      contentType: film.mime,
      // A film never changes once it is up, and it is by far the heaviest thing
      // on the site, so it is worth keeping in the browser and the edge.
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });

  // The poster is optional. Without one the card still works - it falls back to
  // a plain panel - but a film with a picture behind it looks finished and one
  // without looks broken, so the panel always tries to send one.
  let posterFile = '';
  const frame = decodeDataUrl(body?.poster);
  if (frame.bytes && frame.mime.startsWith('image/') && frame.bytes.byteLength <= MAX_POSTER_BYTES) {
    const ext = frame.mime.includes('png') ? 'png' : frame.mime.includes('webp') ? 'webp' : 'jpg';
    posterFile = `posters/${key}.${ext}`;
    await env.VIDEOS.put(posterFile, frame.bytes, {
      httpMetadata: {
        contentType: frame.mime,
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });
  }

  const entry = {
    key,
    title,
    note,
    file: `videos/${key}.${extension}`,
    posterFile,
    size: film.bytes.byteLength,
    added: new Date().toISOString(),
  };
  const videos = [entry, ...existing];
  await writeIndex(env, videos);

  return json({ ok: true, video: publicVideo(entry), total: videos.length }, 201);
}

/** Change a film's details, or move it up or down the page. */
export async function onRequestPut({ request, env }) {
  const who = await isOwner(request, env);
  if (!who.ok) return json({ error: who.reason }, who.status);
  if (!bucketAvailable(env)) return json({ error: 'Video storage is not switched on yet.' }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'That did not arrive intact. Please try again.' }, 400);
  }

  const videos = await readIndex(env);
  if (!videos.length) return json({ error: 'There are no films to change yet.' }, 400);

  // Reordering. The panel sends the whole list of names in the order it wants,
  // which cannot go out of step with what is on screen.
  if (Array.isArray(body?.order)) {
    const byKey = new Map(videos.map((v) => [v.key, v]));
    const wanted = body.order.filter((k) => byKey.has(k));
    // Anything not named keeps its place at the end rather than disappearing.
    for (const v of videos) if (!wanted.includes(v.key)) wanted.push(v.key);
    const ordered = wanted.map((k) => byKey.get(k));
    await writeIndex(env, ordered);
    return json({ ok: true, videos: ordered.map(publicVideo) });
  }

  const key = body?.key;
  if (!isSafeKey(key)) return json({ error: 'Which film?' }, 400);
  const at = videos.findIndex((v) => v.key === key);
  if (at < 0) return json({ error: 'That film is not on the page any more.' }, 404);

  if (body?.title !== undefined) {
    const title = String(body.title).trim().slice(0, 80);
    if (!title) return json({ error: 'A film needs a title.' }, 400);
    videos[at].title = title;
  }
  if (body?.note !== undefined) {
    videos[at].note = String(body.note).trim().slice(0, 200);
  }

  await writeIndex(env, videos);
  return json({ ok: true, video: publicVideo(videos[at]) });
}

/** Remove a film, and its poster. */
export async function onRequestDelete({ request, env }) {
  const who = await isOwner(request, env);
  if (!who.ok) return json({ error: who.reason }, who.status);
  if (!bucketAvailable(env)) return json({ error: 'Video storage is not switched on yet.' }, 503);

  const key = new URL(request.url).searchParams.get('key');
  if (!isSafeKey(key)) return json({ error: 'Which film?' }, 400);

  const videos = await readIndex(env);
  const entry = videos.find((v) => v.key === key);
  if (!entry) return json({ error: 'That film is not on the page any more.' }, 404);

  const kept = videos.filter((v) => v.key !== key);
  await writeIndex(env, kept);

  // The index is written first. If deleting the files were to fail the page
  // would be left with a film nobody can reach, which is untidy; this way the
  // worst case is an orphaned file costing a few megabytes of the free tier.
  for (const object of [entry.file, entry.posterFile]) {
    if (object) await env.VIDEOS.delete(object).catch(() => {});
  }

  return json({ ok: true, total: kept.length });
}

/** A megabyte count a person can read. */
function mb(bytes) {
  return Math.round(bytes / (1024 * 1024));
}
