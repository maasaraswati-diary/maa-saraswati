/**
 * Tells the shop owner that an enquiry has arrived.
 *
 *   POST /api/notify   a new enquiry
 *   POST /api/notify?test=1   ask for a test alert (owner only)
 *
 * Why a Worker is in this path at all. The form posts straight to Firestore, so
 * there is no server between the customer and the database to hang anything on.
 * This is called alongside that write, separately, and does the one thing the
 * owner cannot do without: put something on their phone.
 *
 * Why it is not WhatsApp. Pushing a message to the owner's own number means
 * Meta's WhatsApp Business API, which now charges per message and asks for a
 * payment method before it will send one. Gupshup, Twilio, AiSensy and the rest
 * are the same arrangement in a different coat. So the automatic half of this
 * cannot be WhatsApp without putting a card on the account, which this project
 * will not do.
 *
 * What it is instead: ntfy, a free push service with no account, no card and no
 * per-message charge. The owner subscribes on their phone once and from then on
 * an enquiry rings their handset. The topic lives in this file and not in the
 * browser bundle, so a visitor cannot read it out of the page and push their own
 * messages; the per-address window below stops what a determined one could
 * manage anyway.
 *
 * What goes into the alert: the name, the phone number, and what it was about.
 * Not the message. A lead needs a name and a number to be rung back, and the free
 * text is a customer's own words being handed to a third party's servers for no
 * benefit - the whole enquiry is already in the panel, which is where it gets
 * read. The notification exists to say "there is one, go and look".
 */
import { isOwner } from '../_lib/auth.js';
import { json } from '../_lib/videos.js';

/* Server-side only. This string must never reach client/src. */
const TOPIC = 'maa-enq-be17319946fa0477e184fc0e';

/* Where the alert goes when it is tapped: the panel, on the enquiries tab. */
const PANEL_URL = 'https://maa-saraswati-diary.pages.dev/partner/products?tab=enquiries';

/* One alert per address per twenty minutes. */
const WINDOW_MS = 20 * 60 * 1000;

/** ntfy keeps a message under 4 KB; a lead needs a fraction of that. */
const trim = (v, max = 70) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * The caller's address as Cloudflare sees it.
 *
 * Not exact, and not meant to be: the form is public either way, so this only
 * has to be good enough to slow a script down. It is read from the header
 * Cloudflare sets, never from anything the caller can choose to send itself.
 */
const addressOf = (request) =>
  request.headers.get('CF-Connecting-IP') || 'unknown';

/**
 * Whether this address has had an alert recently.
 *
 * Returns true when one is allowed through. KV is eventually consistent, so this
 * is a speed bump and not a lock: two alerts can still slip out inside the
 * window, which is the right way round. Dropping a genuine lead to save the owner
 * one duplicate is the worse of the two failures.
 */
async function allowed(env, address) {
  const key = `rl:enq:${address}`;
  try {
    const last = await env.VIDEOS.get(key);
    if (last && Date.now() - Number(last) < WINDOW_MS) return false;
    await env.VIDEOS.put(key, String(Date.now()), { expirationTtl: 1800 });
    return true;
  } catch {
    // A rate limiter that cannot store is not a reason to lose the enquiry.
    return true;
  }
}

async function alert(env, { title, body }) {
  await fetch(`https://ntfy.sh/${TOPIC}`, {
    method: 'POST',
    headers: {
      Title: title,
      // 4 is high: a lead that goes unanswered for a day is a lost sale, and
      // this fires a few times a day at most.
      Priority: '4',
      Tags: 'envelope',
      Click: PANEL_URL,
    },
    body,
  });
}

export async function onRequestPost({ request, env }) {
  const isTest = new URL(request.url).searchParams.get('test') === '1';

  // A test is the owner checking their phone, so it skips the rate limit - they
  // would otherwise be locked out by their own first enquiry. It still has to be
  // the owner, because it is a free way to make someone's handset ring.
  if (isTest) {
    const auth = await isOwner(request, env);
    if (!auth.ok) return json({ ok: false, error: auth.reason }, auth.status || 401);
    try {
      await alert(env, {
        title: 'Test alert',
        body: 'This is what an enquiry alert looks like. Nothing is waiting in the panel.',
      });
      return json({ ok: true, sent: true });
    } catch (err) {
      return json({ ok: false, error: String(err?.message || err) }, 502);
    }
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    // Nothing usable came in. There is still an alert to send - the panel will
    // have the enquiry even if this call was mangled - so fall through with an
    // empty body rather than giving up.
  }

  const who = trim(body.name, 60) || 'Someone';
  const phone = trim(body.phone, 24);
  const about = trim(body.subject, 60) || trim(body.product, 60) || 'General enquiry';

  if (await allowed(env, addressOf(request))) {
    try {
      await alert(env, {
        title: `New enquiry - ${about}`,
        body: [
          `Name: ${who}`,
          phone ? `Phone: ${phone}` : null,
          `About: ${about}`,
          '',
          'Open the panel to read it and mark it answered.',
        ]
          .filter(Boolean)
          .join('\n'),
      });
    } catch {
      // The enquiry is in Firestore and the owner can see it in the panel. A
      // push provider being unreachable is not a reason to tell a customer their
      // message did not arrive.
    }
  }

  // Always the same answer, whatever happened. The page must not be able to tell
  // a successful alert from a refused or failed one: that difference is what an
  // endpoint is probed for, and a customer is not an error reporter for our push
  // provider.
  return json({ ok: true });
}
