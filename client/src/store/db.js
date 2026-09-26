/**
 * Firestore data access for the storefront and the partner panel.
 *
 * Every product carries `ownerEmail` so a partner only ever sees and edits
 * their own items, while the public catalogue shows everyone's.
 */
import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';

const nowIso = () => new Date().toISOString();
const newId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * Two collections, on purpose.
 *
 *  'products' - every submission, whatever its review state. Private: only the
 *               shop owner and the partner who submitted it can read it.
 *  'shop'     - the public storefront. A document only lands here once the owner
 *               approves it, so the public catalogue is a plain read with no
 *               query filter, which is what Firestore's rules can safely allow.
 */
const DRAFTS = 'products';
const LIVE = 'shop';

const clean = (v) => (v === undefined ? null : v);

/** Shapes a Firestore product document into the shape the UI expects. */
function toProduct(d) {
  const data = d.data() || {};
  const images = Array.isArray(data.images) ? data.images : [];
  return {
    id: d.id,
    slug: data.slug,
    name: data.name,
    shortName: data.shortName || data.name,
    category: data.category,
    tagline: data.tagline || '',
    taglineEnglish: data.taglineEnglish || '',
    price: Number(data.price) || 0,
    mrp: Number(data.mrp) || 0,
    unit: data.unit || 'pack',
    packSize: data.packSize || '',
    fat: data.fat || null,
    veg: data.veg !== false,
    inStock: data.inStock !== false,
    featured: Boolean(data.featured),
    rating: Number(data.rating) || 0,
    reviewCount: Number(data.reviewCount) || 0,
    soldLabel: data.soldLabel || '',
    shortDescription: data.shortDescription || '',
    description: data.description || [],
    images,
    image: data.image || images[0] || '',
    highlights: data.highlights || [],
    features: data.features || [],
    nutrition: data.nutrition || [],
    usage: data.usage || [],
    faqs: data.faqs || [],
    // 'pending' = waiting for the shop owner's approval,
    // 'approved' = live on the storefront,
    // 'rejected' = sent back with the owner's note.
    status: data.status || 'approved',
    reviewNote: data.reviewNote || '',
    ownerEmail: data.ownerEmail || '',
    ownerName: data.ownerName || '',
    createdAt: data.createdAt || null,
  };
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/* ------------------------------------------------------------------ reads */

/** The public storefront: only products the owner has approved. */
export async function fetchApprovedProducts() {
  // Plain collection read - no `where` clause - so the security rules can allow
  // it outright. The collection only ever contains approved products.
  const snap = await getDocs(collection(db, LIVE));
  return snap.docs
    .map(toProduct)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

/** A partner's own products, whatever their status. */
export async function fetchProductsByOwner(email) {
  const snap = await getDocs(
    query(collection(db, DRAFTS), where('ownerEmail', '==', email))
  );
  return snap.docs
    .map(toProduct)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

/** Everything, for the owner's moderation view. */
export async function fetchAllProducts() {
  const snap = await getDocs(collection(db, DRAFTS));
  return snap.docs
    .map(toProduct)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export async function fetchPendingProducts() {
  const snap = await getDocs(
    query(collection(db, DRAFTS), where('status', '==', 'pending'))
  );
  return snap.docs
    .map(toProduct)
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
}

export async function fetchProductBySlug(slug) {
  const snap = await getDocs(query(collection(db, LIVE), where('slug', '==', slug)));
  const list = snap.docs.map(toProduct);
  const match = list.find((p) => p.slug === slug || p.id === slug);
  if (!match) {
    // Fall back to a plain read, which also covers lookups by document id.
    const all = await fetchApprovedProducts();
    const byId = all.find((p) => p.id === slug);
    if (!byId) return null;
    return { product: byId, related: relatedTo(all, byId) };
  }
  return { product: match, related: relatedTo(list, match) };
}

function relatedTo(list, match) {
  return list
    .filter((p) => p.id !== match.id)
    .sort(
      (a, b) =>
        Number(b.category === match.category) - Number(a.category === match.category)
    )
    .slice(0, 4);
}

export async function fetchEnquiries() {
  const snap = await getDocs(collection(db, 'enquiries'));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

/* ----------------------------------------------------------------- writes */

function toDoc(product) {
  const images = (product.images || []).filter(Boolean);
  return {
    slug: product.slug,
    name: clean(product.name),
    shortName: clean(product.shortName) || clean(product.name),
    category: clean(product.category) || 'Other',
    tagline: clean(product.tagline),
    taglineEnglish: clean(product.taglineEnglish),
    price: Number(product.price) || 0,
    mrp: Number(product.mrp) || 0,
    unit: clean(product.unit) || 'pack',
    packSize: clean(product.packSize),
    fat: clean(product.fat),
    veg: product.veg !== false,
    inStock: product.inStock !== false,
    featured: Boolean(product.featured),
    rating: Number(product.rating) || 0,
    reviewCount: Number(product.reviewCount) || 0,
    soldLabel: clean(product.soldLabel),
    shortDescription: clean(product.shortDescription),
    description: product.description || [],
    images,
    image: images[0] || '',
    highlights: product.highlights || [],
    features: product.features || [],
    nutrition: product.nutrition || [],
    usage: product.usage || [],
    faqs: product.faqs || [],
  };
}

export async function createProduct(product, user) {
  const payload = toDoc(product);
  const id = `p_${newId()}`;
  await setDoc(doc(db, DRAFTS, id), {
    ...payload,
    slug: payload.slug || `${slugify(payload.name)}-${id.slice(-4)}`,
    ownerEmail: user?.email || '',
    ownerName: user?.displayName || user?.email || '',
    // Everything a partner submits waits for the shop owner's approval.
    status: 'pending',
    reviewNote: '',
    createdAt: nowIso(),
  });
  return id;
}

export async function updateProduct(id, product, isOwner = false) {
  const payload = toDoc(product);
  const patch = {
    ...payload,
    slug: payload.slug || slugify(payload.name),
    // When a partner edits an approved product it goes back into the review
    // queue, so the owner sees the change before customers do. The owner's own
    // edits publish straight away.
    ...(isOwner ? {} : { status: 'pending', reviewNote: '' }),
  };
  await setDoc(doc(db, DRAFTS, id), patch, { merge: true });

  // A live product that gets edited by its partner must come off the storefront
  // until the owner has looked at the change.
  if (!isOwner) {
    await deleteDoc(doc(db, LIVE, id)).catch(() => {});
    return;
  }

  // The owner editing their own live product: the storefront reads the `shop`
  // copy, so that copy has to move too. Without this a new picture, price or
  // name would save in the panel and never reach the website.
  const live = await getDoc(doc(db, LIVE, id));
  if (live.exists()) {
    await setDoc(doc(db, LIVE, id), patch, { merge: true });
  }
}

/** Owner-only: put a product live, or send it back with a note. */
export async function setProductStatus(id, status, reviewNote = '') {
  await setDoc(doc(db, DRAFTS, id), { status, reviewNote }, { merge: true });
}

/**
 * Owner-only. Copies the product into the public `shop` collection, which is
 * the only thing the storefront ever reads.
 */
export async function approveProduct(id, note = '') {
  const ref = doc(db, DRAFTS, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Product not found.');
  const data = snap.data();
  await setDoc(doc(db, LIVE, id), { ...data, status: 'approved' });
  await setDoc(ref, { status: 'approved', reviewNote: note }, { merge: true });
}

/** Owner-only. Takes the product off the storefront and tells the partner why. */
export async function rejectProduct(id, note = '') {
  await deleteDoc(doc(db, LIVE, id)).catch(() => {});
  await setDoc(doc(db, DRAFTS, id), { status: 'rejected', reviewNote: note }, { merge: true });
}

export async function removeProduct(id) {
  await deleteDoc(doc(db, LIVE, id)).catch(() => {});
  await deleteDoc(doc(db, DRAFTS, id));
}

export async function setProductInStock(id, inStock) {
  await setDoc(doc(db, DRAFTS, id), { inStock }, { merge: true });
  // Keep the storefront copy in step, but only while the product is live.
  const live = await getDoc(doc(db, LIVE, id));
  if (live.exists()) {
    await setDoc(doc(db, LIVE, id), { inStock }, { merge: true });
  }
}

export async function saveEnquiry(enquiry) {
  await addDoc(collection(db, 'enquiries'), {
    ...enquiry,
    status: 'new',
    createdAt: nowIso(),
  });
}

export async function setEnquiryStatus(id, status) {
  await setDoc(doc(db, 'enquiries', id), { status }, { merge: true });
}

export async function removeEnquiry(id) {
  await deleteDoc(doc(db, 'enquiries', id));
}

/* ------------------------------------------------------------------ drift */

/** Fields the storefront copy has to agree on. */
const SHOP_FIELDS = [
  'name', 'shortName', 'category', 'tagline', 'taglineEnglish', 'price', 'mrp',
  'unit', 'packSize', 'fat', 'veg', 'inStock', 'featured', 'rating',
  'reviewCount', 'soldLabel', 'shortDescription', 'description', 'images',
  'image', 'highlights', 'features', 'nutrition', 'usage', 'faqs', 'slug',
];

/**
 * Owner-only. Brings the storefront back in line with the approved products.
 *
 * The two copies can drift - an edit made while the storefront copy was written
 * at a different moment, say - and a customer would then see a stale picture or
 * price with no sign of it anywhere. Called when the owner opens the panel, so
 * the website repairs itself instead of waiting for someone to notice.
 */
export async function syncShopWithApproved(products) {
  let repaired = 0;
  const removed = [];

  for (const p of products) {
    if (p.status !== 'approved') continue;
    const live = await getDoc(doc(db, LIVE, p.id));

    if (!live.exists) {
      const { id, ...rest } = p;
      await setDoc(doc(db, LIVE, id), { ...rest, status: 'approved' });
      repaired += 1;
      continue;
    }

    const current = live.data();
    const patch = {};
    for (const key of SHOP_FIELDS) {
      if (JSON.stringify(current[key] ?? null) !== JSON.stringify(p[key] ?? null)) {
        patch[key] = p[key] ?? null;
      }
    }
    if (Object.keys(patch).length) {
      await setDoc(doc(db, LIVE, p.id), patch, { merge: true });
      repaired += 1;
    }
  }

  // A product that is no longer approved must not stay on sale.
  const live = await getDocs(collection(db, LIVE));
  const approvedIds = new Set(
    products.filter((p) => p.status === 'approved').map((p) => p.id)
  );
  for (const d of live.docs) {
    if (!approvedIds.has(d.id)) {
      await deleteDoc(d.ref);
      removed.push(d.id);
    }
  }

  return { repaired, removed };
}

/* ------------------------------------------------------------------ images */

// Cloud Storage would be the natural home for uploads, but creating a bucket
// needs a billing account, so pictures live in Firestore instead - already
// optimised to WebP on the way in. `product.image` then holds "upload:<docId>",
// which ProductImage resolves; see firestore.rules for who may read or write.

export const imageRef = (id) => `upload:${id}`;
export const isUploadRef = (ref) =>
  typeof ref === 'string' && ref.startsWith('upload:');
export const uploadIdFromRef = (ref) => String(ref).slice('upload:'.length);

/**
 * Stores an already-optimised picture and returns its reference. The document
 * carries both sizes so a listing page only pulls the thumbnail.
 */
export async function saveProductImage({ large, thumb, name }, user) {
  const id = `img_${newId()}`;
  await setDoc(doc(db, 'uploads', id), {
    ownerEmail: user?.email || '',
    name: name || 'image',
    // Base64 text, so reading it back is a plain string with nothing to convert.
    large: base64Of(large.dataUrl),
    thumb: base64Of(thumb.dataUrl),
    mime: 'image/webp',
    width: large.w,
    height: large.h,
    bytes: large.bytes,
    createdAt: nowIso(),
  });
  return imageRef(id);
}

/** One image document, for the storefront to render. */
export async function fetchProductImage(id) {
  const snap = await getDoc(doc(db, 'uploads', id));
  if (!snap.exists()) return null;
  const d = snap.data();
  const large = dataUrlOf(d.large);
  return {
    large,
    thumb: dataUrlOf(d.thumb) || large,
    width: d.width,
    height: d.height,
  };
}

/**
 * Firestore's `bytes` type round-trips through shapes that differ between the
 * SDK builds, and a picture is already compressed WebP, so the base64 text is
 * stored as an ordinary string. That is a third larger than raw bytes, which
 * still leaves a document far below Firestore's 1 MB ceiling, and it removes a
 * whole class of serialisation problems.
 */
const base64Of = (dataUrl) => String(dataUrl).split(',')[1] || '';
const dataUrlOf = (base64) => (base64 ? `data:image/webp;base64,${base64}` : '');

/* ------------------------------------------------------------ testimonials */

// Written only by the shop owner, read by everyone - see `testimonials` in
// firestore.rules.

/** Public: what customers say about us, in the order the owner arranged. */
export async function fetchTestimonials() {
  const snap = await getDocs(collection(db, 'testimonials'));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort(
      (a, b) =>
        (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0) ||
        String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
    );
}

/** Every field, for a brand new review. */
function toTestimonialDoc(t) {
  return {
    name: clean(t.name),
    role: clean(t.role),
    text: clean(t.text),
    rating: Math.min(5, Math.max(1, Number(t.rating) || 5)),
    sortOrder: Number(t.sortOrder) || 0,
  };
}

/**
 * Only the fields actually present, so a partial update - reordering a single
 * review, say - can never blank out the rest of it.
 */
function toTestimonialPatch(t) {
  const patch = {};
  if (t.name !== undefined) patch.name = clean(t.name);
  if (t.role !== undefined) patch.role = clean(t.role);
  if (t.text !== undefined) patch.text = clean(t.text);
  if (t.rating !== undefined) {
    patch.rating = Math.min(5, Math.max(1, Number(t.rating) || 5));
  }
  if (t.sortOrder !== undefined) patch.sortOrder = Number(t.sortOrder) || 0;
  return patch;
}

export async function createTestimonial(t) {
  const id = `t_${newId()}`;
  await setDoc(doc(db, 'testimonials', id), {
    ...toTestimonialDoc(t),
    createdAt: nowIso(),
  });
  return id;
}

export async function updateTestimonial(id, t) {
  const patch = toTestimonialPatch(t);
  if (!Object.keys(patch).length) return;
  await setDoc(doc(db, 'testimonials', id), patch, { merge: true });
}

export async function removeTestimonial(id) {
  await deleteDoc(doc(db, 'testimonials', id));
}

/**
 * One-time migration of the testimonials that were hard-coded in the page, so
 * the owner can start editing them from the panel. Only runs while the
 * collection is empty.
 */
export async function seedTestimonialsIfEmpty(list) {
  const snap = await getDocs(collection(db, 'testimonials'));
  if (!snap.empty) return { written: 0, skipped: true };

  const batch = writeBatch(db);
  list.forEach((t, i) => {
    batch.set(doc(db, 'testimonials', `seed_${i + 1}`), {
      ...toTestimonialDoc(t),
      sortOrder: i,
      createdAt: nowIso(),
    });
  });
  await batch.commit();
  return { written: list.length, skipped: false };
}

/**
 * One-time migration of the seed catalogue into Firestore, tagged to the shop
 * owner so it shows in their partner list. Only runs when the products
 * collection is still empty.
 */
export async function seedIfEmpty(products, owner) {
  const snap = await getDocs(collection(db, DRAFTS));
  if (!snap.empty) return { written: 0, skipped: true };

  const batch = writeBatch(db);
  products.forEach((p, i) => {
    const payload = {
      ...toDoc(p),
      ownerEmail: owner?.email || '',
      ownerName: 'Maa Saraswati',
      status: 'approved',
      reviewNote: '',
      createdAt: p.createdAt || nowIso(),
      order: i,
    };
    batch.set(doc(db, DRAFTS, p.id), payload);
    // The seed catalogue is the shop's own, so it starts life on the storefront.
    batch.set(doc(db, LIVE, p.id), payload);
  });
  await batch.commit();
  return { written: products.length, skipped: false };
}
