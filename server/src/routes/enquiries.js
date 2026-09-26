import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { readCollection, writeCollection, newId, nowIso } from '../storage/index.js';

const router = Router();

// Basic spam protection: max 5 enquiries per IP per 10 minutes.
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  // Behind a proxy/load balancer `request.ip` can be undefined, which would
  // throw. Fall back to a constant bucket so the limiter degrades safely
  // instead of erroring.
  keyGenerator: (req) => req.ip || 'unknown',
  message: { error: 'Too many requests. Please try again in a few minutes.' },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[0-9+\-\s()]{8,15}$/;

function sanitize(value, max = 500) {
  return String(value ?? '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, max);
}

// POST /api/enquiries
router.post('/', limiter, async (req, res, next) => {
  try {
    const name = sanitize(req.body?.name, 80);
    const email = sanitize(req.body?.email, 120);
    const phone = sanitize(req.body?.phone, 20);
    const subject = sanitize(req.body?.subject, 120) || 'General enquiry';
    const product = sanitize(req.body?.product, 120);
    const message = sanitize(req.body?.message, 2000);

    const errors = {};
    if (name.length < 2) errors.name = 'Please tell us your name.';
    if (!EMAIL_RE.test(email)) errors.email = 'Please enter a valid email address.';
    if (phone && !PHONE_RE.test(phone)) errors.phone = 'Please enter a valid phone number.';
    if (message.length < 10) errors.message = 'Please write at least 10 characters.';

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: 'Please check the form.', fields: errors });
    }

    const enquiries = await readCollection('enquiries');
    const enquiry = {
      id: newId('enq'),
      name,
      email,
      phone,
      subject,
      product,
      message,
      status: 'new',
      createdAt: nowIso(),
    };
    enquiries.unshift(enquiry);
    await writeCollection('enquiries', enquiries.slice(0, 2000));

    console.log(`[enquiry] new from ${name} <${email}> - ${subject}`);
    res.status(201).json({
      message: `Thank you, ${name.split(' ')[0]}! We have received your enquiry and will call you back shortly.`,
      enquiry: { id: enquiry.id, createdAt: enquiry.createdAt },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
