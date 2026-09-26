import { Router } from 'express';
import { readCollection } from '../storage/index.js';

const router = Router();

/** Builds a light product summary (no long copy) for listing views. */
function toSummary(product) {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    shortName: product.shortName || product.name,
    category: product.category,
    tagline: product.tagline,
    taglineEnglish: product.taglineEnglish,
    price: product.price,
    mrp: product.mrp,
    unit: product.unit,
    packSize: product.packSize,
    fat: product.fat ?? null,
    veg: product.veg !== false,
    inStock: product.inStock !== false,
    featured: Boolean(product.featured),
    rating: product.rating ?? 0,
    reviewCount: product.reviewCount ?? 0,
    soldLabel: product.soldLabel || '',
    shortDescription: product.shortDescription || '',
    image: product.images?.[0] || '',
    images: product.images || [],
    highlights: product.highlights || [],
  };
}

// GET /api/products
router.get('/', async (req, res, next) => {
  try {
    const { category, featured, q, inStock } = req.query;
    let products = await readCollection('products');

    if (category && category !== 'All') {
      products = products.filter((p) => p.category === category);
    }
    if (featured === 'true') {
      products = products.filter((p) => p.featured);
    }
    if (inStock === 'true') {
      products = products.filter((p) => p.inStock !== false);
    }
    if (q) {
      const needle = String(q).toLowerCase();
      products = products.filter((p) =>
        [p.name, p.shortName, p.category, p.shortDescription, p.tagline]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(needle))
      );
    }

    const sorted = [...products].sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );

    res.json({
      count: sorted.length,
      products: sorted.map(toSummary),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/categories
router.get('/categories', async (_req, res, next) => {
  try {
    const products = await readCollection('products');
    const counts = new Map();
    for (const p of products) {
      const key = p.category || 'Other';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const categories = [{ name: 'All', count: products.length }];
    for (const [name, count] of counts) categories.push({ name, count });
    res.json({ categories });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:idOrSlug
router.get('/:idOrSlug', async (req, res, next) => {
  try {
    const { idOrSlug } = req.params;
    const products = await readCollection('products');
    const product = products.find(
      (p) => p.id === idOrSlug || p.slug === idOrSlug
    );
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    // Related products from the same category, then fall back to others.
    const related = products
      .filter((p) => p.id !== product.id)
      .sort((a, b) => {
        const aSame = a.category === product.category ? 1 : 0;
        const bSame = b.category === product.category ? 1 : 0;
        return bSame - aSame;
      })
      .slice(0, 4)
      .map(toSummary);

    res.json({ product, related });
  } catch (err) {
    next(err);
  }
});

export default router;
export { toSummary };
