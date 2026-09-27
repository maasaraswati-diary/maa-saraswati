/**
 * The films themselves, /media/videos/<name> and /media/posters/<name>.
 *
 * Serving them through here rather than straight off the store keeps everything
 * on one address: no cross-origin rules, no extra domain to set up, and the
 * pictures and the films cannot drift apart. It also means a poster that has been
 * deleted stops being served at once.
 *
 * A film has to be able to start playing before it has finished arriving, or
 * seeking forward is impossible - so the Range header is honoured with a 206 and
 * a Content-Range. Without it a viewer waits for the whole file before the first
 * frame appears.
 */
import { filmKey, isSafeKey, posterKey, storageAvailable } from '../_lib/videos.js';

/** Only these two folders, and only these names, are ever served. */
const SERVEABLE = /^(videos|posters)\/([a-z0-9][a-z0-9-]{0,59})$/;

/**
 * Work out which bytes a Range header is asking for.
 *
 * Only the single-range form is honoured - "bytes=0-1023" and "bytes=1024-" -
 * which is all a browser sends. A multi-range request, or one asking for a
 * suffix it does not need, is answered with the whole file and a 200: a player
 * given a 200 plays it, where a player given a malformed 206 stops.
 */
export function parseRange(header, size) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!m) return null;
  const [, rawStart, rawEnd] = m;
  if (rawStart === '' && rawEnd === '') return null;

  let start;
  let end;
  if (rawStart === '') {
    // The last N bytes.
    const length = Number(rawEnd);
    if (!length) return null;
    start = Math.max(0, size - length);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return null;
  return { start, end };
}

async function handle({ request, env, params }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: 'GET, HEAD' },
    });
  }

  if (!storageAvailable(env)) {
    return new Response('Video storage is not available.', {
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
  const [, folder, name] = match;
  // The pattern already limits the name, but the check that actually guards the
  // store is the one that says what a name may be.
  if (!isSafeKey(name)) {
    return new Response('Not found', { status: 404 });
  }

  const key = folder === 'videos' ? filmKey(name) : posterKey(name);
  const stored = await env.VIDEOS.getWithMetadata(key, 'arrayBuffer');
  if (!stored || !stored.value) {
    return new Response('Not found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const bytes = stored.value;
  const size = bytes.byteLength;
  // What the film was stored as, not what its name suggests.
  const contentType = stored.metadata?.contentType || 'application/octet-stream';

  const headers = new Headers({
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Accept-Ranges': 'bytes',
  });

  // A partial reply is only ever the right answer to a request that asked for
  // part of the file, so the status follows the request.
  const range = parseRange(request.headers.get('Range'), size);
  if (range) {
    const slice = bytes.slice(range.start, range.end + 1);
    headers.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
    headers.set('Content-Length', String(slice.byteLength));
    return new Response(request.method === 'HEAD' ? null : slice, { status: 206, headers });
  }

  headers.set('Content-Length', String(size));
  return new Response(request.method === 'HEAD' ? null : bytes, { status: 200, headers });
}

export const onRequestGet = handle;
export const onRequestHead = handle;
