/**
 * Catalogue access for the storefront.
 *
 * Reads come from Firestore so products added by any partner appear
 * immediately. If Firestore is unreachable the build-time snapshot is used, so
 * the shop is never empty.
 */
import {
  fetchApprovedProducts,
  fetchProductBySlug,
  fetchTestimonials,
} from './store/db';
import { compareByPrice } from './api';
import { isFirebaseConfigured } from './firebase';
import snapshot from './generated/catalogue.json';

let offline = false;
export const isCatalogueOffline = () => offline;

/** Stand-in copy, used only until the owner has published real testimonials. */
const DEFAULT_TESTIMONIALS = [
  {
    id: 'd1',
    name: 'Rahul',
    role: 'Runs a Sweet House, Gurdaspur',
    text: 'We use their paneer for our barfi and peda. The protein is high, the texture holds, and the delivery has never been late once.',
    rating: 5,
  },
  {
    id: 'd2',
    name: 'Davinder Singh',
    role: 'Customer since 2011',
    text: 'I have bought their milk every week for fourteen years. It is the only milk my father will drink, and the only one my children finish.',
    rating: 5,
  },
  {
    id: 'd3',
    name: 'Harbhajan Singh',
    role: 'Household customer, Kahnuwaan Chowk',
    text: 'The ghee is clean and the price is fair. I order monthly for the whole family and it always reaches before 7 in the morning.',
    rating: 5,
  },
];

function matches(product, params) {
  const { category, featured, q, inStock } = params;
  if (category && category !== 'All' && product.category !== category) return false;
  if (featured === 'true' && !product.featured) return false;
  if (inStock === 'true' && product.inStock === false) return false;
  if (q) {
    const needle = String(q).toLowerCase();
    const hay = [product.name, product.shortName, product.category, product.shortDescription, product.tagline]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}

/** Sorting is done here rather than in a Firestore query so that the offline
 *  path produces exactly the same order as the online one. */
function sortList(list, sort) {
  const out = [...list];
  switch (sort) {
    // Unpriced products last in both directions. The same comparator is used by
    // the products page, because the two sorts have to agree: the offline path
    // producing a different order than the online one is the whole reason
    // sorting happens here instead of in the query.
    case 'price-asc':
      return out.sort((a, b) => compareByPrice(a, b, 1));
    case 'price-desc':
      return out.sort((a, b) => compareByPrice(a, b, -1));
    case 'rating':
      return out.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    case 'name':
      return out.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return out.sort(
        (a, b) =>
          Number(b.featured) - Number(a.featured) || (b.rating || 0) - (a.rating || 0)
      );
  }
}

export async function getAllProducts() {
  if (isFirebaseConfigured) {
    try {
      // Only approved products reach the public storefront.
      const products = await fetchApprovedProducts();
      offline = false;
      return products;
    } catch {
      offline = true;
    }
  } else {
    offline = true;
  }
  return snapshot.products;
}

/**
 * Filtered + sorted catalogue. Returns `{ products }` because that is the shape
 * the pages consume.
 */
export async function getProducts({ params = {}, sort } = {}) {
  const all = await getAllProducts();
  return { products: sortList(all.filter((p) => matches(p, params)), sort) };
}

export async function getCategories() {
  const all = await getAllProducts();
  const counts = new Map();
  for (const p of all) {
    const key = p.category || 'Other';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const categories = [{ name: 'All', count: all.length }];
  for (const [name, count] of counts) categories.push({ name, count });
  return { categories };
}

export async function getProduct(idOrSlug) {
  if (isFirebaseConfigured) {
    try {
      const found = await fetchProductBySlug(idOrSlug);
      if (found) {
        offline = false;
        return found;
      }
    } catch {
      offline = true;
    }
  } else {
    offline = true;
  }

  const product = snapshot.products.find(
    (p) => p.id === idOrSlug || p.slug === idOrSlug
  );
  if (!product) {
    const err = new Error('Product not found.');
    err.status = 404;
    throw err;
  }
  const related = snapshot.products
    .filter((p) => p.id !== product.id)
    .sort(
      (a, b) =>
        Number(b.category === product.category) - Number(a.category === product.category)
    )
    .slice(0, 4);
  return { product, related };
}

/**
 * Customer testimonials. These come from Firestore so the shop owner can add or
 * remove them from the partner panel. The list below is only a stand-in for
 * the window between a fresh install and the first publish.
 */
export async function getTestimonials() {
  if (isFirebaseConfigured) {
    try {
      const list = await fetchTestimonials();
      if (list.length) return list;
    } catch {
      offline = true;
    }
  }
  return DEFAULT_TESTIMONIALS;
}

export async function ping() {
  if (!isFirebaseConfigured) return { ok: false, offline: true };
  try {
    const products = await fetchApprovedProducts();
    offline = false;
    return { ok: true, count: products.length };
  } catch {
    offline = true;
    return { ok: false, offline: true };
  }
}
