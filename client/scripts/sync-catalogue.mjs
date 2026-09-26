/**
 * Copies the product catalogue into the frontend bundle at build time.
 *
 * The live site reads products from the API. If the API is unreachable (for
 * example while the free host is waking up) the storefront falls back to this
 * snapshot, so customers always see the shop instead of an error.
 *
 * Run automatically by `npm run build` in client/ via the prebuild script.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const SOURCE = path.join(ROOT, 'server', 'data', 'products.json');
const TARGET = path.join(ROOT, 'client', 'src', 'generated', 'catalogue.json');

function stripServerFields(products) {
  return products.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    shortName: p.shortName || p.name,
    category: p.category,
    tagline: p.tagline,
    taglineEnglish: p.taglineEnglish,
    price: p.price,
    mrp: p.mrp,
    unit: p.unit,
    packSize: p.packSize,
    fat: p.fat ?? null,
    veg: p.veg !== false,
    inStock: p.inStock !== false,
    featured: Boolean(p.featured),
    rating: p.rating ?? 0,
    reviewCount: p.reviewCount ?? 0,
    soldLabel: p.soldLabel || '',
    shortDescription: p.shortDescription || '',
    description: p.description || [],
    images: p.images || [],
    // The API's list endpoint returns a single `image` alongside `images`;
    // mirror that here so product cards work from the snapshot too.
    image: p.images?.[0] || '',
    highlights: p.highlights || [],
    features: p.features || [],
    nutrition: p.nutrition || [],
    usage: p.usage || [],
    faqs: p.faqs || [],
  }));
}

if (!fs.existsSync(SOURCE)) {
  console.warn('[catalogue] no server/data/products.json - skipping snapshot');
  process.exit(0);
}

const products = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
if (!Array.isArray(products) || products.length === 0) {
  console.warn('[catalogue] products.json is empty - skipping snapshot');
  process.exit(0);
}

const snapshot = {
  builtAt: new Date().toISOString(),
  count: products.length,
  products: stripServerFields(products),
};

fs.mkdirSync(path.dirname(TARGET), { recursive: true });
fs.writeFileSync(TARGET, JSON.stringify(snapshot, null, 2), 'utf8');
console.log(
  `[catalogue] snapshotted ${snapshot.count} products -> client/src/generated/catalogue.json`
);
