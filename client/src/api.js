/**
 * Base URL for API calls.
 *
 * Empty by default, which keeps requests same-origin at `/api/...`. That works
 * out of the box on Firebase Hosting because hosting rewrites `/api/**` to the
 * Cloud Function. Set VITE_API_BASE only if the API is hosted on a different
 * domain (for example a separate Render or Railway service).
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

/** Formats a rupee amount with Indian digit grouping. */
export function formatPrice(value) {
  const n = Number(value) || 0;
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
