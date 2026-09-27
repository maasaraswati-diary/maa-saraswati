/**
 * Who is calling?
 *
 * The panel is a normal web page, so anyone in the world can send anything to
 * these endpoints. The browser's Firebase login proves to the panel that the
 * person is the owner, but a promise made in the browser is worth nothing - the
 * files would still need checking here, on the server, before anything is
 * written.
 *
 * So every call that changes anything carries the sign-in token, and that token
 * is checked against Google's identity service here. The token cannot be forged
 * without the password, and the account it belongs to has to be on the owners
 * list. Everything else - the panel, Firestore's rules, the R2 binding - is
 * downstream of this check.
 */

/**
 * Public. This ships inside the site's JavaScript bundle and is not a secret -
 * it only identifies the project, and Google's identity service needs it to look
 * a token up at all. It can be overridden with a plain text secret if the
 * project is ever moved.
 */
const FIREBASE_API_KEY = 'AIzaSyDnrPsWBJNpNV35VJ0yJ5phognup1QC73Y';

/** The accounts allowed to change the films. */
const DEFAULT_OWNERS = ['kunalkalia261085@gmail.com'];

/** Split a comma separated list of addresses, ignoring blanks and stray spaces. */
function ownerList(env) {
  const raw = typeof env?.OWNER_EMAILS === 'string' ? env.OWNER_EMAILS : DEFAULT_OWNERS.join(',');
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Pull the sign-in token out of the Authorization header, if it is there. */
function bearer(request) {
  const header = request.headers.get('Authorization') || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

/**
 * Is this request from the owner?
 *
 * Returns { ok: true, email } or { ok: false, status, reason }. The reason is
 * written for the person in the panel, not for a log file.
 */
export async function isOwner(request, env) {
  const token = bearer(request);
  if (!token) {
    return { ok: false, status: 401, reason: 'Please sign in to the panel first.' };
  }

  const key = env?.FIREBASE_API_KEY || FIREBASE_API_KEY;
  let users;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      }
    );
    if (!res.ok) {
      // A rejected token is the common case and it always means the same thing
      // to the person using the panel: sign in again.
      return { ok: false, status: 401, reason: 'Your sign-in has expired. Please sign in again.' };
    }
    users = (await res.json())?.users;
  } catch {
    return {
      ok: false,
      status: 503,
      reason: 'Could not check who you are. Please check your internet and try again.',
    };
  }

  const email = String(users?.[0]?.email || '').toLowerCase();
  if (!email || !ownerList(env).includes(email)) {
    return { ok: false, status: 403, reason: 'Only the owner can change the videos.' };
  }
  return { ok: true, email };
}
