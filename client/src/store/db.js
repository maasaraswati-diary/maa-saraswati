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
  const snap = await getDocs(
    query(collection(db, 'products'), where('status', '==', 'approved'))
  );
  return snap.docs
    .map(toProduct)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

/** A partner's own products, whatever their status. */
export async function fetchProductsByOwner(email) {
  const snap = await getDocs(
    query(collection(db, 'products'), where('ownerEmail', '==', email))
  );
  return snap.docs
    .map(toProduct)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

/** Everything, for the owner's moderation view. */
export async function fetchAllProducts() {
  const snap = await getDocs(collection(db, 'products'));
  return snap.docs
    .map(toProduct)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export async function fetchPendingProducts() {
  const snap = await getDocs(
    query(collection(db, 'products'), where('status', '==', 'pending'))
  );
  return snap.docs
    .map(toProduct)
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
}

export async function fetchProductBySlug(slug) {
  const snap = await getDocs(
    query(collection(db, 'products'), where('status', '==', 'approved'))
  );
  const list = snap.docs.map(toProduct);
  const match = list.find((p) => p.slug === slug || p.id === slug);
  if (!match) return null;
  const related = list
    .filter((p) => p.id !== match.id)
    .sort(
      (a, b) =>
        Number(b.category === match.category) - Number(a.category === match.category)
    )
    .slice(0, 4);
  return { product: match, related };
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
  await setDoc(doc(db, 'products', id), {
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

export async function updateProduct(id, product) {
  const payload = toDoc(product);
  await setDoc(
    doc(db, 'products', id),
    { ...payload, slug: payload.slug || slugify(payload.name) },
    { merge: true }
  );
}

/** Owner-only: put a product live, or send it back with a note. */
export async function setProductStatus(id, status, reviewNote = '') {
  await setDoc(doc(db, 'products', id), { status, reviewNote }, { merge: true });
}

export const approveProduct = (id, note = '') => setProductStatus(id, 'approved', note);
export const rejectProduct = (id, note = '') => setProductStatus(id, 'rejected', note);

export async function removeProduct(id) {
  await deleteDoc(doc(db, 'products', id));
}

export async function setProductInStock(id, inStock) {
  await setDoc(doc(db, 'products', id), { inStock }, { merge: true });
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

/**
 * One-time migration of the seed catalogue into Firestore, tagged to the shop
 * owner so it shows in their partner list. Only runs when the products
 * collection is still empty.
 */
export async function seedIfEmpty(products, owner) {
  const snap = await getDocs(collection(db, 'products'));
  if (!snap.empty) return { written: 0, skipped: true };

  const batch = writeBatch(db);
  products.forEach((p, i) => {
    batch.set(doc(db, 'products', p.id), {
      ...toDoc(p),
      ownerEmail: owner?.email || '',
      ownerName: 'Maa Saraswati',
      createdAt: p.createdAt || nowIso(),
      order: i,
    });
  });
  await batch.commit();
  return { written: products.length, skipped: false };
}
