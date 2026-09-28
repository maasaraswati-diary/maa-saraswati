/**
 * Tells the shop owner that an enquiry has arrived.
 *
 *   POST /api/notify            a new enquiry
 *   POST /api/notify?test=1     ask for a test alert (owner only)
 *
 * Why a Worker is in this path at all. The form posts straight to Firestore, so
 * there is no server between the customer and the database to hang anything on.
 * This is called alongside that write, separately, and does the one thing the
 * owner cannot do without: put something on their phone.
 *
 * Why Telegram, and what was tried before it.
 *
 * The first attempt was ntfy, a push service with no account and no card, and
 * it is free for a reason worth stating plainly: the publishing quota is one
 * pool shared by every anonymous caller on the entire service. It was exhausted
 * within a day of being switched on, and ntfy answered every message with
 * "daily message quota reached; increase your limits with a paid plan". Nothing
 * arrived, and nothing would have.
 *
 * So it is a Telegram bot now. Free, no card, no quota to be shared out, and the
 * message lands as a real phone notification.
 *
 * Why not WhatsApp for the automatic half. A message pushed to the owner's own
 * number needs Meta's WhatsApp Business API, which charges per message and asks
 * for a payment method. Gupshup, Twilio and AiSensy are the same arrangement in a
 * different coat. The customer is offered the WhatsApp shortcut themselves after
 * submitting - one extra tap - which is what that constraint costs.
 *
 * What goes into the alert: the name, the phone number, and what it was about.
 * Not the message. A lead needs a number to be rung back, and the free text is a
 * customer's own words being handed to a third party for no benefit - the whole
 * enquiry is already in the panel, which is where it gets read. The alert exists
 * to say "there is one, go and look".
 */
import { isOwner } from '../_lib/auth.js';
import { json } from '../_lib/videos.js';

/* Where the alert goes when it is tapped: the panel, on the enquiries tab. */
const PANEL_URL = 'https://maa-saraswati-diary.pages.dev/partner/products?tab=enquiries';

/* One alert per address per twenty minutes. */
const WINDOW_MS = 20 * 60 * 1000;

/* Telegram refuses a text message over 4096 characters. Nothing here comes
   close, but the cap is what stops a future edit from turning a lead into an
   error. */
const MAX_TEXT = 3800;

const trim = (v, max = 70) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * The caller's address as Cloudflare sees it.
 *
 * Not exact, and not meant to be: the form is public either way, so this only
 * has to be good enough to slow a script down. Read from the header Cloudflare
 * sets, never from anything the caller can choose to send itself.
 */
const addressOf = (request) => request.headers.get('CF-Connecting-IP') || 'unknown';

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
    if (last && Date.now() - Number(last) < WINDOW_MS) {
      console.log('notify: within the window, not sending');
      return false;
    }
    await env.VIDEOS.put(key, String(Date.now()), { expirationTtl: 1800 });
    return true;
  } catch (err) {
    // A rate limiter that cannot store is not a reason to lose the enquiry.
    // Said out loud, because a missing KV binding looks exactly like a quiet
    // success and would otherwise cost a day to find.
    console.log(`notify: rate limit storage unavailable :: ${String(err?.message || err)}`);
    return true;
  }
}

/**
 * Is there a bot to send with?
 *
 * Both values are Pages secrets, set with `wrangler pages secret put`, and the
 * token is not a thing that may be committed: the repository is public, and a
 * token in it would let anyone send messages as this shop. Absent, the shop
 * still works - the enquiry is in the panel either way - so this only has to be
 * true, not loud.
 */
const configured = (env) =>
  Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);

/**
 * Sends one alert, and says in the log whether it arrived.
 *
 * The status check is the point. This did not look at the response to begin
 * with, which meant a provider refusing the message looked exactly like one that
 * had been sent - and the first version of this told the owner the alerts were
 * working while a shared quota was swallowing every one of them. A silent
 * failure that cannot be told from a success is the worst kind.
 *
 * Nothing identifying goes in the log: no token, no chat, no lead's details.
 */
async function alert(env, { title, body }) {
  const res = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: `${title}\n\n${body}`.slice(0, MAX_TEXT),
        // Telegram would otherwise try to fetch a URL in the text and show a
        // preview for it. The one URL here is ours, in a button.
        disable_web_page_preview: true,
        // A button, so the alert leads straight to the enquiry instead of the
        // owner having to open Telegram and then find the panel.
        reply_markup: {
          inline_keyboard: [[{ text: 'Open the enquiry', url: PANEL_URL }]],
        },
        disable_notification: false,
      }),
    }
  );

  if (!res.ok) {
    // Telegram's own words, which are the only clue there is. "bot was blocked
    // by the user" and "Not Found" mean very different things and both arrive
    // as a failure here.
    const detail = await res.text().catch(() => '');
    console.log(`notify: telegram refused ${res.status} :: ${detail.slice(0, 300)}`);
    throw new Error(`telegram refused: ${res.status}`);
  }

  const data = await res.json().catch(() => null);
  console.log(`notify: sent (ok=${data?.ok})`);
  return data;
}

export async function onRequestPost({ request, env }) {
  const isTest = new URL(request.url).searchParams.get('test') === '1';

  // A test is the owner checking their phone, so it skips the rate limit - they
  // would otherwise be locked out by their own first enquiry. It still has to be
  // the owner, because it is a free way to make someone's handset ring.
  if (isTest) {
    const auth = await isOwner(request, env);
    if (!auth.ok) return json({ ok: false, error: auth.reason }, auth.status || 401);
    if (!configured(env)) {
      return json(
        {
          ok: false,
          error:
            'The alert is not set up yet. It needs a Telegram bot token and a chat id as Pages secrets.',
        },
        501
      );
    }
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

  if (!configured(env)) {
    // Said out loud. This branch is silent otherwise, and it was: the secrets
    // were set against a deployment that had already been replaced, so the
    // running code could not see them, every enquiry returned a cheerful
    // success, and no alert was sent. The second time a provider could refuse in
    // silence is one too many - the log is where this has to show up.
    console.log('notify: no bot configured, nothing sent');
  } else if (await allowed(env, addressOf(request))) {
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
    } catch (err) {
      // The enquiry is in Firestore and the owner can see it in the panel. A
      // notification failing is not a reason to tell a customer their message did
      // not arrive. It is said out loud, though, because "the alerts are broken"
      // has to be findable somewhere - it was not, and that is why a swallowed
      // quota went unnoticed.
      console.log(`notify: not delivered :: ${String(err?.message || err)}`);
    }
  }

  // Always the same answer, whatever happened. The page must not be able to tell
  // a delivered alert from a refused or failed one: that difference is what an
  // endpoint is probed for, and a customer is not an error reporter for our
  // notification provider.
  return json({ ok: true });
}
