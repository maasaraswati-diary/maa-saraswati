import { useState } from 'react';
import Icon from './Icons';
import { useToast } from './Toast';
import { saveEnquiry } from '../store/db';
import { isFirebaseConfigured } from '../firebase';
import { SITE } from '../site';
import { api } from '../api';

export const SUBJECTS = [
  'General enquiry',
  'Bulk / wholesale order',
  'Product question',
  'Delivery or supply issue',
  'Feedback or complaint',
  'Partnership / distribution',
];

const EMPTY = { name: '', email: '', phone: '', subject: SUBJECTS[0], message: '' };

/**
 * The enquiry as one block of text, for sending on WhatsApp.
 *
 * Built once and kept, because the form is cleared the moment it is sent and the
 * customer is offered the WhatsApp shortcut afterwards. Reconstructing it from
 * an emptied form is how the offer ends up opening a blank message.
 */
function whatsAppBody(p) {
  return [
    `Name: ${p.name}`,
    `Phone: ${p.phone || '-'}`,
    `Email: ${p.email}`,
    `Subject: ${p.subject}`,
    p.product ? `Product: ${p.product}` : null,
    '',
    p.message,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Rings the shop owner's phone.
 *
 * Fired and forgotten. The enquiry is already in Firestore by this point, so
 * nothing about the customer depends on this call succeeding: the only thing
 * lost if it fails is the notification, and telling a customer their message did
 * not arrive because a push provider is down would be a lie and a lost lead.
 */
function notifyOwner(payload) {
  try {
    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: payload.name,
        phone: payload.phone,
        subject: payload.subject,
        product: payload.product,
      }),
    }).catch(() => {});
  } catch {
    // Nothing to do. See above.
  }
}

/**
 * The customer enquiry form. Used on the Contact page and inside the floating
 * enquiry modal, so validation and submission live in one place.
 *
 * Props:
 *   initialMessage  pre-fills the message box (e.g. from a product page)
 *   hiddenProduct   product name stored with the enquiry
 *   onDone          called with the API response after a successful submit
 *   showWhatsApp    renders the WhatsApp shortcut (Contact page only)
 */
export default function EnquiryForm({
  initialMessage = '',
  hiddenProduct = '',
  onDone,
  showWhatsApp = false,
}) {
  const toast = useToast();
  const [form, setForm] = useState({ ...EMPTY, message: initialMessage });
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  // What was just sent, kept only so the WhatsApp shortcut can quote it back.
  const [sent, setSent] = useState(null);

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((x) => ({ ...x, [key]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Please tell us your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim()))
      e.email = 'Please enter a valid email address.';
    if (form.phone.trim() && !/^[0-9+\-\s()]{8,15}$/.test(form.phone.trim()))
      e.phone = 'Please enter a valid phone number.';
    if (form.message.trim().length < 10)
      e.message = 'Please write at least 10 characters so we can help.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) {
      toast.error('Please fix the highlighted fields.');
      return;
    }
    setSending(true);
    const payload = { ...form, product: hiddenProduct };
    try {
      // Firestore is the primary path now; the REST API remains a fallback for a
      // self-hosted backend.
      if (isFirebaseConfigured) {
        await saveEnquiry(payload);
        setDone(true);
        setSent(payload);
        setForm({ ...EMPTY });
        // Only once the enquiry is safely in Firestore, so the owner is never
        // alerted about a message that was not saved.
        notifyOwner(payload);
        toast.success(
          `Thank you ${form.name.split(' ')[0]}! We have received your enquiry.`
        );
        onDone?.({ via: 'firestore' });
        return;
      }
      const res = await api.sendEnquiry(payload);
      setDone(true);
      setSent(payload);
      setForm({ ...EMPTY });
      notifyOwner(payload);
      toast.success(res.message);
      onDone?.(res);
    } catch (err) {
      // The API is unreachable. Rather than lose the enquiry, hand the customer
      // a pre-filled WhatsApp message so the lead still reaches us.
      if (err.status === 0) {
        toast.error(
          'Could not reach our server. Opening WhatsApp with your message — just press send.'
        );
        window.open(SITE.whatsappEnquiry(whatsAppBody(payload)), '_blank', 'noopener');
        setForm({ ...EMPTY });
        onDone?.({ offline: true });
        return;
      }
      if (err.fields) setErrors(err.fields);
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      {done && (
        <div className="done-banner">
          <span className="done-icon">
            <Icon.CheckCircle size={22} />
          </span>
          <div>
            <strong>Thank you — we have your enquiry.</strong>
            <p className="muted" style={{ fontSize: '0.9rem' }}>
              Our team will call you back within one working day. For anything
              urgent, ring +91 98143 91854.
            </p>
            {/* The enquiry is saved, so this is a second, faster way to reach us
                rather than the only one - which is why it is offered instead of
                pushed. Sending it here opens WhatsApp on the customer's own
                phone with the enquiry already written out; they press send.
                That extra tap is the price of not asking this project for a
                card: a message pushed to our number on its own needs Meta's
                paid API. */}
            {sent && (
              <a
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 10 }}
                target="_blank"
                rel="noopener noreferrer"
                href={SITE.whatsappEnquiry(whatsAppBody(sent))}
              >
                <Icon.Whatsapp size={17} /> Also send it on WhatsApp
              </a>
            )}
          </div>
        </div>
      )}

      <div className="form-row">
        <div className="field">
          <label className="label" htmlFor="enq-name">
            Your Name <span className="req">*</span>
          </label>
          <input
            id="enq-name"
            className={`input ${errors.name ? 'err' : ''}`}
            value={form.name}
            onChange={set('name')}
            placeholder="e.g. Ravi Kumar"
            autoComplete="name"
          />
          {errors.name && (
            <span className="field-error">
              <Icon.Alert size={14} /> {errors.name}
            </span>
          )}
        </div>

        <div className="field">
          <label className="label" htmlFor="enq-phone">
            Phone Number
          </label>
          <input
            id="enq-phone"
            className={`input ${errors.phone ? 'err' : ''}`}
            value={form.phone}
            onChange={set('phone')}
            placeholder="e.g. 98143 91854"
            inputMode="tel"
            autoComplete="tel"
          />
          {errors.phone && (
            <span className="field-error">
              <Icon.Alert size={14} /> {errors.phone}
            </span>
          )}
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="enq-email">
          Email Address <span className="req">*</span>
        </label>
        <input
          id="enq-email"
          type="email"
          className={`input ${errors.email ? 'err' : ''}`}
          value={form.email}
          onChange={set('email')}
          placeholder="e.g. ravi@example.com"
          autoComplete="email"
        />
        {errors.email && (
          <span className="field-error">
            <Icon.Alert size={14} /> {errors.email}
          </span>
        )}
      </div>

      <div className="field">
        <label className="label" htmlFor="enq-subject">
          What is this about?
        </label>
        <select
          id="enq-subject"
          className="select"
          value={form.subject}
          onChange={set('subject')}
        >
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="label" htmlFor="enq-message">
          Your Message <span className="req">*</span>
        </label>
        <textarea
          id="enq-message"
          className={`textarea ${errors.message ? 'err' : ''}`}
          value={form.message}
          onChange={set('message')}
          placeholder="Tell us what you need — quantity, pin code, delivery time, or your question."
        />
        {errors.message && (
          <span className="field-error">
            <Icon.Alert size={14} /> {errors.message}
          </span>
        )}
        <span className="hint">
          {form.message.trim().length} characters · the more detail you give, the
          faster we can help.
        </span>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-brand btn-lg" disabled={sending}>
          {sending ? (
            <>
              <span className="btn-spin" /> Sending…
            </>
          ) : (
            <>
              <Icon.Mail size={19} /> Send Enquiry
            </>
          )}
        </button>
        {showWhatsApp && (
          <a
            href={SITE.whatsapp}
            className="btn btn-ghost btn-lg"
            target="_blank"
            rel="noreferrer"
          >
            <Icon.Whatsapp size={19} /> WhatsApp Us
          </a>
        )}
      </div>
    </form>
  );
}
