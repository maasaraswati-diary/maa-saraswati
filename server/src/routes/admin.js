import { Router } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { rateLimit } from 'express-rate-limit';
import { readCollection, writeCollection, newId, nowIso } from '../storage/index.js';
import { UPLOAD_DIR, saveUpload } from '../storage/uploads.js';
import { signToken, requireAdmin } from '../auth.js';

const router = Router();

/* ------------------------------------------------------------------ */
/* login                                                              */
/* ------------------------------------------------------------------ */

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // `request.ip` is not always populated behind a load balancer; without this
  // fallback the limiter would throw instead of limiting.
  keyGenerator: (req) => req.ip || 'unknown',
  message: { error: 'Too many login attempts. Please try again later.' },
});

// POST /api/admin/login
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const users = await readCollection('users');
    const user = users.find((u) => u.email.toLowerCase() === email);
    const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;

    if (!user || !ok) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    res.json({
      token: signToken(user),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ */
/* everything below this line requires an admin token                  */
/* ------------------------------------------------------------------ */

router.use(requireAdmin);

// GET /api/admin/me
router.get('/me', (req, res) => {
  res.json({ user: req.user });
});

// GET /api/admin/stats
router.get('/stats', async (_req, res, next) => {
  try {
    const [products, enquiries] = await Promise.all([
      readCollection('products'),
      readCollection('enquiries'),
    ]);
    res.json({
      totalProducts: products.length,
      featuredProducts: products.filter((p) => p.featured).length,
      outOfStock: products.filter((p) => p.inStock === false).length,
      totalEnquiries: enquiries.length,
      newEnquiries: enquiries.filter((e) => e.status === 'new').length,
      inventoryValue: products.reduce(
        (sum, p) => sum + (Number(p.price) || 0) * (Number(p.stock) || 0),
        0
      ),
    });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ */
/* products                                                            */
/* ------------------------------------------------------------------ */

// Multer writes to a temp path; saveUpload() then moves the file to local disk
// or to Cloud Storage. diskStorage (not `dest`) is required so the filename
// callback below controls the extension.
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /^image\/(jpe?g|png|webp|gif|avif|svg\+xml)$/i;
    if (!allowed.test(file.mimetype)) {
      return cb(new Error('Only image files are allowed.'));
    }
    cb(null, true);
  },
});

// POST /api/admin/upload  (field name: "image")
router.post('/upload', async (req, res, next) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No image was uploaded.' });
    }
    try {
      const url = await saveUpload(req.file);
      res.status(201).json({ url });
    } catch (e) {
      next(e);
    }
  });
});

function str(value, max = 2000) {
  return String(value ?? '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, max);
}

function toArray(value) {
  if (Array.isArray(value)) return value.map((v) => str(v, 400)).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Normalises an incoming product payload into our stored shape. */
function buildProduct(body, existing = {}) {
  const name = str(body?.name, 120) || existing.name || 'Untitled Product';
  const baseSlug = slugify(body?.slug || name) || 'product';
  const slug = baseSlug || 'product';

  return {
    ...existing,
    id: existing.id || newId('prod'),
    slug,
    name,
    shortName: str(body?.shortName, 60) || existing.shortName || name,
    category: str(body?.category, 60) || existing.category || 'Other',
    tagline: str(body?.tagline, 120),
    taglineEnglish: str(body?.taglineEnglish, 160),
    price: num(body?.price, existing.price ?? 0),
    mrp: num(body?.mrp, existing.mrp ?? 0),
    unit: str(body?.unit, 30) || existing.unit || 'pack',
    packSize: str(body?.packSize, 40),
    fat: str(body?.fat, 20) || null,
    veg: body?.veg === undefined ? existing.veg !== false : Boolean(body.veg),
    inStock:
      body?.inStock === undefined ? existing.inStock !== false : Boolean(body.inStock),
    featured:
      body?.featured === undefined
        ? Boolean(existing.featured)
        : Boolean(body.featured),
    rating: num(body?.rating, existing.rating ?? 0),
    reviewCount: num(body?.reviewCount, existing.reviewCount ?? 0),
    soldLabel: str(body?.soldLabel, 80),
    shortDescription: str(body?.shortDescription, 300),
    description: toArray(body?.description ?? existing.description),
    images: toArray(body?.images ?? existing.images).slice(0, 8),
    highlights: toArray(body?.highlights ?? existing.highlights).slice(0, 8),
    features: Array.isArray(body?.features)
      ? body.features
          .filter((f) => f && (f.title || f.text))
          .slice(0, 8)
          .map((f) => ({
            icon: str(f.icon, 30) || 'drop',
            title: str(f.title, 80),
            text: str(f.text, 300),
          }))
      : existing.features || [],
    nutrition: Array.isArray(body?.nutrition)
      ? body.nutrition
          .filter((n) => n && (n.label || n.value))
          .slice(0, 8)
          .map((n) => ({
            label: str(n.label, 60),
            value: str(n.value, 40),
            per: str(n.per, 40),
          }))
      : existing.nutrition || [],
    usage: toArray(body?.usage ?? existing.usage).slice(0, 8),
    faqs: Array.isArray(body?.faqs)
      ? body.faqs
          .filter((f) => f && (f.q || f.a))
          .slice(0, 12)
          .map((f) => ({ q: str(f.q, 200), a: str(f.a, 800) }))
      : existing.faqs || [],
    createdAt: existing.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

// GET /api/admin/products
router.get('/products', async (_req, res, next) => {
  try {
    const products = await readCollection('products');
    res.json({ count: products.length, products });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/products
router.post('/products', async (req, res, next) => {
  try {
    const products = await readCollection('products');
    const product = buildProduct(req.body);

    if (!product.price || product.price <= 0) {
      return res.status(400).json({ error: 'Please enter a valid price.' });
    }

    // Ensure slugs stay unique.
    let slug = product.slug;
    let n = 1;
    while (products.some((p) => p.slug === slug)) slug = `${product.slug}-${++n}`;
    product.slug = slug;

    products.unshift(product);
    await writeCollection('products', products);
    res.status(201).json({ message: 'Product created.', product });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/products/:id
router.put('/products/:id', async (req, res, next) => {
  try {
    const products = await readCollection('products');
    const index = products.findIndex((p) => p.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const updated = buildProduct(req.body, products[index]);
    if (!updated.price || updated.price <= 0) {
      return res.status(400).json({ error: 'Please enter a valid price.' });
    }

    let slug = updated.slug;
    let n = 1;
    while (
      products.some((p) => p.slug === slug && p.id !== updated.id)
    ) {
      slug = `${updated.slug}-${++n}`;
    }
    updated.slug = slug;

    products[index] = updated;
    await writeCollection('products', products);
    res.json({ message: 'Product updated.', product: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/products/:id
router.delete('/products/:id', async (req, res, next) => {
  try {
    const products = await readCollection('products');
    const next_ = products.filter((p) => p.id !== req.params.id);
    if (next_.length === products.length) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    await writeCollection('products', next_);
    res.json({ message: 'Product deleted.' });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ */
/* enquiries                                                           */
/* ------------------------------------------------------------------ */

// GET /api/admin/enquiries
router.get('/enquiries', async (_req, res, next) => {
  try {
    const enquiries = await readCollection('enquiries');
    res.json({ count: enquiries.length, enquiries });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/enquiries/:id
router.patch('/enquiries/:id', async (req, res, next) => {
  try {
    const status = str(req.body?.status, 20);
    if (!['new', 'contacted', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    const enquiries = await readCollection('enquiries');
    const enquiry = enquiries.find((e) => e.id === req.params.id);
    if (!enquiry) {
      return res.status(404).json({ error: 'Enquiry not found.' });
    }
    enquiry.status = status;
    enquiry.updatedAt = nowIso();
    await writeCollection('enquiries', enquiries);
    res.json({ message: 'Enquiry updated.', enquiry });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/enquiries/:id
router.delete('/enquiries/:id', async (req, res, next) => {
  try {
    const enquiries = await readCollection('enquiries');
    const next_ = enquiries.filter((e) => e.id !== req.params.id);
    if (next_.length === enquiries.length) {
      return res.status(404).json({ error: 'Enquiry not found.' });
    }
    await writeCollection('enquiries', next_);
    res.json({ message: 'Enquiry deleted.' });
  } catch (err) {
    next(err);
  }
});

export default router;
