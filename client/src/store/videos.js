/**
 * Talking to the video endpoints.
 *
 * These live on Cloudflare, next to the site itself (/api/videos), and store
 * films in Workers KV. Firestore was not used for this deliberately: a document
 * there is capped at one megabyte, a film is not, and a new collection would
 * have meant editing and publishing security rules by hand in the Firebase
 * console. The endpoint checks the owner's sign-in token on the server instead,
 * which is the same protection without the console.
 *
 * Nothing here throws a raw network error at the panel. Every failure arrives
 * as a sentence worth showing the owner, because "Failed to fetch" tells the
 * person in front of it nothing at all.
 */
import { auth } from '../firebase';

/** Where the films are listed and changed. Same address as the page. */
const ENDPOINT = '/api/videos';

/**
 * The most the endpoint will take. The store's own limit is 25 MB; the panel
 * sends the file base64-encoded, so the ceiling here is a little lower and the
 * message the owner sees is in these terms.
 */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const ACCEPTED = ['video/mp4', 'video/webm'];

/** The owner's sign-in token, which is what proves who is asking. */
async function idToken() {
  const user = auth?.currentUser;
  if (!user) throw new Error('Please sign in to the panel first.');
  return user.getIdToken();
}

/**
 * One request, and one honest error message.
 *
 * `authed` is false for the public list, which anybody may ask for.
 */
async function call(path = '', { method = 'GET', body, authed = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (authed) {
    try {
      headers.Authorization = `Bearer ${await idToken()}`;
    } catch (err) {
      throw err;
    }
  }

  let res;
  try {
    res = await fetch(ENDPOINT + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Could not reach the server. Check your internet and try again.');
  }

  // A 404 or 502 from the edge is not JSON, and trying to parse it as JSON
  // turns a clear "not deployed" into a confusing syntax error.
  let data = {};
  try {
    data = await res.json();
  } catch {
    throw new Error(
      res.ok
        ? 'The server sent something unexpected.'
        : 'The video service is not available at the moment. Please try again shortly.'
    );
  }

  if (!res.ok) throw new Error(data?.error || 'Something went wrong. Please try again.');
  return data;
}

/**
 * The films, for the public page. Never throws - see useVideoAds.
 *
 * `fresh` asks the server for the list of record rather than its fast copy. The
 * panel uses it after every change: the owner has just pressed a button, and
 * being shown a list that does not yet include what they just did is worse than
 * waiting a moment longer for the answer.
 */
export async function fetchVideoList({ fresh = false } = {}) {
  const data = await call(fresh ? '?fresh=1' : '', { authed: false });
  return { available: data.available !== false, videos: Array.isArray(data.videos) ? data.videos : [] };
}

/** A film on the page, for the panel. */
export async function uploadVideo({ file, title, note, poster }) {
  const readAsDataUrl = (f) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('That file could not be read. Please choose it again.'));
      reader.readAsDataURL(f);
    });

  return call('', {
    method: 'POST',
    body: {
      title,
      note: note || '',
      file: await readAsDataUrl(file),
      poster: poster || '',
    },
  });
}

/** Change a film's title or its one-line note. */
export function updateVideo(key, patch) {
  return call('', { method: 'PUT', body: { key, ...patch } });
}

/** Put the films back in the order they were given. */
export function reorderVideos(order) {
  return call('', { method: 'PUT', body: { order } });
}

/** Take a film off the page, and delete it. */
export function deleteVideo(key) {
  return call(`?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
}

/** Is this file one the panel will accept? Returns a reason when it is not. */
export function checkFile(file) {
  if (!file) return 'Please choose a video file.';
  // Some phones report a type the browser has never heard of, or none at all, so
  // the ending of the name is trusted when the type is unhelpful.
  const byName = /\.(mp4|webm|mov|m4v)$/i.test(file.name);
  if (!ACCEPTED.includes(file.type) && !(byName && !file.type)) {
    return 'Please choose an MP4 or WebM file.';
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `That film is ${(file.size / 1048576).toFixed(1)} MB. The limit is 20 MB.`;
  }
  return null;
}
