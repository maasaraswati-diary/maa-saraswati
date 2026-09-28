/**
 * Price formatting, plus an HTTP client that the site no longer depends on.
 *
 * The storefront and the partner panel talk to Cloud Firestore straight from the
 * browser - see `store/db.js` - so there is no application server and no
 * `/api/...` rewriting in the hosting config. The request helpers below are
 * kept only as a fallback for the enquiry form, and the admin calls in here
 * refer to the old JWT API that has been replaced by Firebase Auth.
 *
 * Nothing sets VITE_API_BASE any more; if you ever do point it somewhere, the
 * calls must be same-origin or CORS-enabled.
 */
const API_BASE = (import.meta.env?.VITE_API_BASE || '').replace(/\/$/, '');

const TOKEN_KEY = 'ms_admin_token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable (private mode) - session stays in memory only */
  }
}

export function clearToken() {
  setToken('');
}

/** Thrown for any non-2xx response so callers can read `message`. */
export class ApiError extends Error {
  constructor(message, status, fields) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields || null;
  }
}

async function request(path, { method = 'GET', body, auth = false, isForm } = {}) {
  const headers = {};
  if (body && !isForm) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      'Cannot reach the server. Please check that the API is running.',
      0
    );
  }

  const isJson = (res.headers.get('content-type') || '').includes(
    'application/json'
  );
  const data = isJson ? await res.json().catch(() => ({})) : {};

  if (!res.ok) {
    throw new ApiError(
      data.error || `Request failed (${res.status})`,
      res.status,
      data.fields
    );
  }
  return data;
}

export const api = {
  getProducts: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v != null)
    ).toString();
    return request(`/products${qs ? `?${qs}` : ''}`);
  },
  getCategories: () => request('/products/categories'),
  getProduct: (idOrSlug) => request(`/products/${idOrSlug}`),

  sendEnquiry: (payload) =>
    request('/enquiries', { method: 'POST', body: payload }),

  getHealth: () => request('/health'),

  admin: {
    login: (email, password) =>
      request('/admin/login', { method: 'POST', body: { email, password } }),
    me: () => request('/admin/me', { auth: true }),
    stats: () => request('/admin/stats', { auth: true }),

    getProducts: () => request('/admin/products', { auth: true }),
    createProduct: (payload) =>
      request('/admin/products', { method: 'POST', body: payload, auth: true }),
    updateProduct: (id, payload) =>
      request(`/admin/products/${id}`, {
        method: 'PUT',
        body: payload,
        auth: true,
      }),
    deleteProduct: (id) =>
      request(`/admin/products/${id}`, { method: 'DELETE', auth: true }),

    getEnquiries: () => request('/admin/enquiries', { auth: true }),
    updateEnquiry: (id, status) =>
      request(`/admin/enquiries/${id}`, {
        method: 'PATCH',
        body: { status },
        auth: true,
      }),
    deleteEnquiry: (id) =>
      request(`/admin/enquiries/${id}`, { method: 'DELETE', auth: true }),

    uploadImage: (file) => {
      const fd = new FormData();
      fd.append('image', file);
      return request('/admin/upload', {
        method: 'POST',
        body: fd,
        isForm: true,
        auth: true,
      });
    },
  },
};

/**
 * A product's price as a number, or null when there is not one.
 *
 * Null and zero have to stay two different things, and that difference is the
 * whole point of letting the owner leave the price off. `Number(x) || 0` folds
 * "not posted" into "zero", and a zero prints as ₹0 - which tells a customer the
 * paneer is free rather than that the shop will quote them for it.
 *
 * A zero coming back as null is deliberate. A rupee price of zero on a dairy
 * product is a slip of the keyboard, not a product, and blank is the reading the
 * owner meant.
 */
export function toPrice(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** True when the shop has posted a price for this product. */
export function hasPrice(product) {
  return toPrice(product?.price) !== null;
}

/** Shown in place of a price the shop has not posted. */
export const PRICE_ON_REQUEST = 'Price on request';

/**
 * Orders products by price, for the two sort options on the catalogue.
 *
 * Unpriced products go to the end whichever way the list is going. Sorting them
 * as plain numbers turns null into a zero, which put every product the shop had
 * not priced at the top of "cheapest first" - the least-known items leading the
 * page, ahead of everything actually for sale.
 */
export function compareByPrice(a, b, direction = 1) {
  const pa = toPrice(a?.price);
  const pb = toPrice(b?.price);
  if (pa === null && pb === null) return 0;
  if (pa === null) return 1;
  if (pb === null) return -1;
  return direction * (pa - pb);
}

/**
 * Formats a rupee amount with Indian digit grouping.
 *
 * Blank for anything that is not a number, so a call site left behind by the
 * price change shows nothing rather than making a claim. Zero still prints as
 * ₹0, because this also formats sums - the panel's listed value is honestly zero
 * when nothing in the catalogue is priced.
 */
export function formatPrice(value) {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/** "1,284" -> "1.3k" for compact stat displays. */
export function compactNumber(value) {
  const n = Number(value) || 0;
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function discountPercent(price, mrp) {
  const p = Number(price) || 0;
  const m = Number(mrp) || 0;
  if (!p || !m || m <= p) return 0;
  return Math.round(((m - p) / m) * 100);
}
