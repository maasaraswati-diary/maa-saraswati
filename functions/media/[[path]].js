/**
 * The films themselves, /media/videos/<name>.mp4 and /media/posters/<name>.jpg.
 *
 * Serving them through here rather than straight off the bucket keeps everything
 * on one address: no cross-origin rules, no extra domain to set up or pay for,
 * and the pictures and the films cannot drift apart. It also means a poster that
 * has been deleted stops being served at once.
 *
 * A film has to be able to start playing before it has finished arriving, or
 * seeking forward is impossible - so the Range header is passed straight through
 * to the bucket and a 206 is handed back. Without it a viewer has to wait for
 * the whole file before the first frame appears.
 */
import { bucketAvailable, isSafeKey } from '../_lib/videos.js';

/** Only these two folders, and only these endings, are ever served. */
const SERVEABLE = /^(videos|posters)\/([a-z0-9][a-z0-9-]{0,59})\.(mp4|webm|jpg|png|webp|avif)$/;

async function handle({ request, env, params }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: 'GET, HEAD' },
    });
  }

  if (!bucketAvailable(env)) {
    return new Response('Video storage is not switched on yet.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const path = Array.isArray(params?.path)
    ? params.path.join('/')
    : String(params?.path || '');
  const match = path.match(SERVEABLE);
  if (!match) {
    return new Response('Not found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  // The pattern already limits the name, but the check that actually guards the
  // bucket is the one that says what a name may be.
  if (!isSafeKey(match[2])) {
    return new Response('Not found', { status: 404 });
  }

  // Passing the request's own headers lets the bucket read the Range header -
  // but only when there is one. Handed a range option it has been asked for, a
  // request that asked for nothing must get the whole file back with a 200, not
  // a 206 covering all of it: some browsers treat that as a partial reply to a
  // request they never made part of, and an image arrives marked incomplete.
  const rangeHeader = request.headers.get('Range');
  let object = null;
  if (rangeHeader) {
    try {
      object = await env.VIDEOS.get(path, { range: request.headers });
    } catch {
      object = null;
    }
  }
  if (!object) object = await env.VIDEOS.get(path);

  if (!object) {
    return new Response('Not found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const headers = new Headers();
  // The content type and cache lifetime were recorded when the file was stored,
  // so they travel with it rather than being guessed at here.
  object.writeHttpMetadata(headers);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  if (object.httpEtag) headers.set('ETag', object.httpEtag);

  // A partial reply is only ever the right answer to a request that asked for
  // part of the file, so the status follows the request rather than whatever
  // the bucket happens to report. Handed a range option, some R2
  // implementations fill in a range covering the whole file even when none was
  // asked for, and a 206 saying "here is everything" is not something a
  // browser asked for.
  const partial = Boolean(rangeHeader) && Boolean(object.range);
  if (partial) {
    const { offset, length } = object.range;
    headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
    return new Response(request.method === 'HEAD' ? null : object.body, { status: 206, headers });
  }

  return new Response(request.method === 'HEAD' ? null : object.body, { status: 200, headers });
}

export const onRequestGet = handle;
export const onRequestHead = handle;
