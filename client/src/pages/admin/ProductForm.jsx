import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/Icons';
import { useToast } from '../../components/Toast';
import { api } from '../../api';
import { useFetch } from '../../hooks';

const ICON_CHOICES = [
  'drop',
  'shield',
  'nutrition',
  'family',
  'muscle',
  'bone',
  'leaf',
  'fire',
  'snow',
  'award',
  'sparkle',
  'truck',
];

const CATEGORIES = [
  'Milk',
  'Milk & Beverages',
  'Paneer & Cheese',
  'Curd & Cream',
  'Butter & Ghee',
  'Other',
];

const BLANK = {
  name: '',
  shortName: '',
  category: 'Milk',
  tagline: '',
  taglineEnglish: '',
  price: '',
  mrp: '',
  unit: 'pouch',
  packSize: '',
  fat: '',
  veg: true,
  inStock: true,
  featured: false,
  rating: 4.5,
  reviewCount: 0,
  soldLabel: '',
  shortDescription: '',
  description: '',
  images: [],
  highlights: '',
  usage: '',
  features: [],
  nutrition: [],
  faqs: [],
};

/** Converts a textarea's newline-separated text into an array. */
const lines = (text) =>
  String(text || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

export default function ProductForm() {
  const { id } = useParams();
  const isEdit = Boolean(id) && id !== 'new';
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState(BLANK);
  const [texts, setTexts] = useState({ description: '', highlights: '', usage: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [uploading, setUploading] = useState(false);

  const categoriesData = useFetch(() => api.getCategories(), []);
  // Tells us whether the host keeps uploaded files or wipes them on restart.
  const health = useFetch(() => api.getHealth(), []);
  const uploadsEphemeral = health.data?.uploads === 'ephemeral';

  // Load the existing product when editing.
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    (async () => {
      try {
        const all = await api.admin.getProducts();
        const p = all.products.find((x) => x.id === id);
        if (!p) throw new Error('Product not found.');
        if (cancelled) return;
        setForm({
          ...BLANK,
          ...p,
          price: String(p.price ?? ''),
          mrp: String(p.mrp ?? ''),
        });
        setTexts({
          description: (p.description || []).join('\n'),
          highlights: (p.highlights || []).join('\n'),
          usage: (p.usage || []).join('\n'),
        });
      } catch (err) {
        if (!cancelled) toast.error(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((x) => ({ ...x, [key]: undefined }));
  };

  const setText = (key) => (e) => setTexts((t) => ({ ...t, [key]: e.target.value }));

  /* ------------------------------------------------ dynamic lists */

  const updateItem = (field, i, key, value) =>
    setForm((f) => {
      const next = [...f[field]];
      next[i] = { ...next[i], [key]: value };
      return { ...f, [field]: next };
    });

  const addItem = (field, blank) =>
    setForm((f) => ({ ...f, [field]: [...f[field], blank] }));

  const removeItem = (field, i) =>
    setForm((f) => ({
      ...f,
      [field]: f[field].filter((_, idx) => idx !== i),
    }));

  /* ------------------------------------------------ images */

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.admin.uploadImage(file);
      setForm((f) => ({ ...f, images: [...f.images, res.url] }));
      toast.success('Image uploaded.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const addImageUrl = () => {
    const url = window.prompt('Paste an image path or URL:');
    if (url && url.trim()) setForm((f) => ({ ...f, images: [...f.images, url.trim()] }));
  };

  /* ------------------------------------------------ submit */

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Product name is required.';
    if (!form.price || Number(form.price) <= 0) e.price = 'Enter a valid price.';
    if (form.mrp && Number(form.mrp) < Number(form.price))
      e.mrp = 'MRP cannot be lower than the selling price.';
    if (!form.images.length) e.images = 'Add at least one product image.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) {
      toast.error('Please fix the highlighted fields.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setBusy(true);
    const payload = {
      ...form,
      price: Number(form.price),
      mrp: Number(form.mrp) || Number(form.price),
      rating: Number(form.rating) || 0,
      reviewCount: Number(form.reviewCount) || 0,
      description: lines(texts.description),
      highlights: lines(texts.highlights),
      usage: lines(texts.usage),
      fat: form.fat || null,
    };
    try {
      if (isEdit) {
        await api.admin.updateProduct(id, payload);
        toast.success('Product updated successfully.');
      } else {
        await api.admin.createProduct(payload);
        toast.success('Product created successfully.');
      }
      navigate('/admin/dashboard');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const margin = useMemo(() => {
    const p = Number(form.price) || 0;
    const m = Number(form.mrp) || 0;
    if (!p || !m || m <= p) return null;
    return {
      amount: m - p,
      pct: Math.round(((m - p) / m) * 100),
    };
  }, [form.price, form.mrp]);

  if (loading) {
    return (
      <section className="admin-sec">
        <div className="container">
          <p className="muted" style={{ padding: 40 }}>
            Loading product…
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-sec">
      <div className="container">
        <div className="admin-head">
          <div>
            <span className="eyebrow">
              <Link to="/admin/dashboard">Admin</Link> / Products
            </span>
            <h1 className="h2">
              {isEdit ? 'Edit Product' : 'Add New Product'}
            </h1>
          </div>
          <Link to="/admin/dashboard" className="btn btn-ghost btn-sm">
            <Icon.ArrowLeft size={16} /> Back to Dashboard
          </Link>
        </div>

        <form className="form-admin" onSubmit={submit} noValidate>
          {/* ------------------------------------------------ basics */}
          <div className="card form-card">
            <div className="admin-card-head">
              <h2 className="h3">
                <Icon.Tag size={19} /> Basic Details
              </h2>
            </div>

            <div className="form-row">
              <div className="field">
                <label className="label" htmlFor="name">
                  Product Name <span className="req">*</span>
                </label>
                <input
                  id="name"
                  className={`input ${errors.name ? 'err' : ''}`}
                  value={form.name}
                  onChange={set('name')}
                  placeholder="e.g. Pasteurized Standardized Milk"
                />
                {errors.name && (
                  <span className="field-error">
                    <Icon.Alert size={14} /> {errors.name}
                  </span>
                )}
              </div>

              <div className="field">
                <label className="label" htmlFor="shortName">
                  Short Name
                </label>
                <input
                  id="shortName"
                  className="input"
                  value={form.shortName}
                  onChange={set('shortName')}
                  placeholder="e.g. Standardized Milk"
                />
                <span className="hint">Used on product cards.</span>
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label className="label" htmlFor="category">
                  Category
                </label>
                <select
                  id="category"
                  className="select"
                  value={form.category}
                  onChange={set('category')}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="label" htmlFor="packSize">
                  Pack Size
                </label>
                <input
                  id="packSize"
                  className="input"
                  value={form.packSize}
                  onChange={set('packSize')}
                  placeholder="e.g. 500 ml"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label className="label" htmlFor="tagline">
                  Tagline (on pack)
                </label>
                <input
                  id="tagline"
                  className="input"
                  value={form.tagline}
                  onChange={set('tagline')}
                  placeholder="e.g. Shuddhata ka Vaada"
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="taglineEnglish">
                  Tagline (English)
                </label>
                <input
                  id="taglineEnglish"
                  className="input"
                  value={form.taglineEnglish}
                  onChange={set('taglineEnglish')}
                  placeholder="e.g. A promise of purity"
                />
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="shortDescription">
                Short Description
              </label>
              <textarea
                id="shortDescription"
                className="textarea"
                style={{ minHeight: 80 }}
                value={form.shortDescription}
                onChange={set('shortDescription')}
                placeholder="One line shown on cards and at the top of the product page."
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="description">
                Full Description
              </label>
              <textarea
                id="description"
                className="textarea"
                value={texts.description}
                onChange={setText('description')}
                placeholder="One paragraph per line. Each line becomes a separate paragraph on the product page."
              />
              <span className="hint">
                One paragraph per line —{' '}
                {lines(texts.description).length} paragraph(s) will render.
              </span>
            </div>
          </div>

          {/* ------------------------------------------------ pricing */}
          <div className="card form-card">
            <div className="admin-card-head">
              <h2 className="h3">
                <Icon.Wallet size={19} /> Pricing &amp; Pack
              </h2>
            </div>

            <div className="form-row form-row-3">
              <div className="field">
                <label className="label" htmlFor="price">
                  Selling Price (₹) <span className="req">*</span>
                </label>
                <input
                  id="price"
                  type="number"
                  min="0"
                  className={`input ${errors.price ? 'err' : ''}`}
                  value={form.price}
                  onChange={set('price')}
                  placeholder="56"
                />
                {errors.price && (
                  <span className="field-error">
                    <Icon.Alert size={14} /> {errors.price}
                  </span>
                )}
              </div>

              <div className="field">
                <label className="label" htmlFor="mrp">
                  MRP (₹)
                </label>
                <input
                  id="mrp"
                  type="number"
                  min="0"
                  className={`input ${errors.mrp ? 'err' : ''}`}
                  value={form.mrp}
                  onChange={set('mrp')}
                  placeholder="62"
                />
                {errors.mrp && (
                  <span className="field-error">
                    <Icon.Alert size={14} /> {errors.mrp}
                  </span>
                )}
              </div>

              <div className="field">
                <label className="label" htmlFor="unit">
                  Unit
                </label>
                <input
                  id="unit"
                  className="input"
                  value={form.unit}
                  onChange={set('unit')}
                  placeholder="pouch / pack / tub / jar"
                />
              </div>
            </div>

            {margin && (
              <div className="margin-note">
                <Icon.Tag size={16} />
                <span>
                  Discount shown to customers: <strong>{margin.pct}%</strong>{' '}
                  (₹{margin.amount} off)
                </span>
              </div>
            )}

            <div className="form-row form-row-3">
              <div className="field">
                <label className="label" htmlFor="fat">
                  Fat % (optional)
                </label>
                <input
                  id="fat"
                  className="input"
                  value={form.fat}
                  onChange={set('fat')}
                  placeholder="4.5%"
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="rating">
                  Rating
                </label>
                <input
                  id="rating"
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  className="input"
                  value={form.rating}
                  onChange={set('rating')}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="reviewCount">
                  Review Count
                </label>
                <input
                  id="reviewCount"
                  type="number"
                  min="0"
                  className="input"
                  value={form.reviewCount}
                  onChange={set('reviewCount')}
                />
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="soldLabel">
                Sales Label
              </label>
              <input
                id="soldLabel"
                className="input"
                value={form.soldLabel}
                onChange={set('soldLabel')}
                placeholder="e.g. 12,400+ pouches sold this month"
              />
            </div>

            <div className="switch-row">
              <label className="checkbox">
                <input type="checkbox" checked={form.veg} onChange={set('veg')} />
                100% Vegetarian
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={form.inStock}
                  onChange={set('inStock')}
                />
                In stock
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={set('featured')}
                />
                Show as featured / bestseller
              </label>
            </div>
          </div>

          {/* ------------------------------------------------ images */}
          <div className="card form-card">
            <div className="admin-card-head">
              <h2 className="h3">
                <Icon.Upload size={19} /> Product Images
              </h2>
            </div>

            {uploadsEphemeral && (
              <div className="notice notice-warn" style={{ marginBottom: 16 }}>
                <Icon.Alert size={18} />
                <div>
                  <strong>This host does not keep uploaded files.</strong>
                  <p>
                    Images you upload here will disappear when the server
                    restarts. For images that must stay, add the photo to{' '}
                    <code>client/public/images/products/</code> and use{' '}
                    <strong>Add by path</strong> with a link like{' '}
                    <code>/images/products/your-photo.jpg</code>.
                  </p>
                </div>
              </div>
            )}

            {errors.images && (
              <span className="field-error" style={{ marginBottom: 12 }}>
                <Icon.Alert size={14} /> {errors.images}
              </span>
            )}

            <div className="img-upload-row">
              <label className={`upload-btn ${uploading ? 'busy' : ''}`}>
                <Icon.Upload size={17} />
                {uploading ? 'Uploading…' : 'Upload Image'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={onUpload}
                  hidden
                  disabled={uploading}
                />
              </label>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={addImageUrl}
              >
                <Icon.Plus size={15} /> Add by path
              </button>
              <span className="hint">First image is used as the main photo.</span>
            </div>

            <div className="img-list">
              {form.images.map((src, i) => (
                <div key={src + i} className="img-item">
                  <img src={src} alt="" />
                  {i === 0 && <span className="badge badge-red img-main">Main</span>}
                  <div className="img-item-tools">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() =>
                        setForm((f) => {
                          const next = [...f.images];
                          if (i > 0) [next[i - 1], next[i]] = [next[i], next[i - 1]];
                          return { ...f, images: next };
                        })
                      }
                      disabled={i === 0}
                      title="Move earlier"
                    >
                      <Icon.ArrowLeft size={15} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn danger"
                      onClick={() => removeItem('images', i)}
                      title="Remove image"
                    >
                      <Icon.Trash size={15} />
                    </button>
                  </div>
                </div>
              ))}
              {form.images.length === 0 && (
                <p className="muted" style={{ padding: 14 }}>
                  No images yet. Upload a photo or add an existing path such as{' '}
                  <code>/images/products/milk-poster.jpeg</code>.
                </p>
              )}
            </div>
          </div>

          {/* ------------------------------------------------ highlights & usage */}
          <div className="card form-card">
            <div className="admin-card-head">
              <h2 className="h3">
                <Icon.CheckCircle size={19} /> Highlights &amp; Usage
              </h2>
            </div>

            <div className="form-row">
              <div className="field">
                <label className="label" htmlFor="highlights">
                  Highlights (one per line, max 8)
                </label>
                <textarea
                  id="highlights"
                  className="textarea"
                  style={{ minHeight: 100 }}
                  value={texts.highlights}
                  onChange={setText('highlights')}
                  placeholder={'100% Pure Milk\nFrom healthy cows\nQuality you trust'}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="usage">
                  Best used in (one per line, max 8)
                </label>
                <textarea
                  id="usage"
                  className="textarea"
                  style={{ minHeight: 100 }}
                  value={texts.usage}
                  onChange={setText('usage')}
                  placeholder={'Tea and coffee\nCurd and paneer at home\nPorridge and smoothies'}
                />
              </div>
            </div>
          </div>

          {/* ------------------------------------------------ nutrition */}
          <div className="card form-card">
            <div className="admin-card-head">
              <h2 className="h3">
                <Icon.Nutrient size={19} /> Nutrition Facts
              </h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  addItem('nutrition', { label: '', value: '', per: 'per 100 g' })
                }
              >
                <Icon.Plus size={15} /> Add Row
              </button>
            </div>

            {form.nutrition.map((n, i) => (
              <div key={i} className="dyn-row">
                <input
                  className="input"
                  placeholder="Label (e.g. Protein)"
                  value={n.label}
                  onChange={(e) => updateItem('nutrition', i, 'label', e.target.value)}
                />
                <input
                  className="input"
                  placeholder="Value (e.g. 18 g)"
                  value={n.value}
                  onChange={(e) => updateItem('nutrition', i, 'value', e.target.value)}
                />
                <input
                  className="input"
                  placeholder="Per (e.g. per 100 g)"
                  value={n.per}
                  onChange={(e) => updateItem('nutrition', i, 'per', e.target.value)}
                />
                <button
                  type="button"
                  className="icon-btn danger"
                  onClick={() => removeItem('nutrition', i)}
                >
                  <Icon.Trash size={16} />
                </button>
              </div>
            ))}
            {form.nutrition.length === 0 && (
              <p className="muted" style={{ padding: '10px 0' }}>
                No nutrition rows yet.
              </p>
            )}
          </div>

          {/* ------------------------------------------------ features */}
          <div className="card form-card">
            <div className="admin-card-head">
              <h2 className="h3">
                <Icon.Sparkle size={19} /> Feature Cards
              </h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  addItem('features', { icon: 'drop', title: '', text: '' })
                }
              >
                <Icon.Plus size={15} /> Add Feature
              </button>
            </div>

            {form.features.map((f, i) => (
              <div key={i} className="dyn-block">
                <div className="dyn-block-head">
                  <span className="badge">Feature {i + 1}</span>
                  <button
                    type="button"
                    className="icon-btn danger"
                    onClick={() => removeItem('features', i)}
                  >
                    <Icon.Trash size={16} />
                  </button>
                </div>
                <div className="form-row form-row-3">
                  <div className="field">
                    <label className="label">Icon</label>
                    <select
                      className="select"
                      value={f.icon}
                      onChange={(e) =>
                        updateItem('features', i, 'icon', e.target.value)
                      }
                    >
                      {ICON_CHOICES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="label">Title</label>
                    <input
                      className="input"
                      value={f.title}
                      onChange={(e) =>
                        updateItem('features', i, 'title', e.target.value)
                      }
                      placeholder="e.g. 100% Pure Milk"
                    />
                  </div>
                  <div className="field">
                    <label className="label">Text</label>
                    <input
                      className="input"
                      value={f.text}
                      onChange={(e) =>
                        updateItem('features', i, 'text', e.target.value)
                      }
                      placeholder="Short supporting line"
                    />
                  </div>
                </div>
              </div>
            ))}
            {form.features.length === 0 && (
              <p className="muted" style={{ padding: '10px 0' }}>
                No feature cards yet.
              </p>
            )}
          </div>

          {/* ------------------------------------------------ faqs */}
          <div className="card form-card">
            <div className="admin-card-head">
              <h2 className="h3">
                <Icon.Info size={19} /> FAQs
              </h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => addItem('faqs', { q: '', a: '' })}
              >
                <Icon.Plus size={15} /> Add Question
              </button>
            </div>

            {form.faqs.map((f, i) => (
              <div key={i} className="dyn-block">
                <div className="dyn-block-head">
                  <span className="badge">Question {i + 1}</span>
                  <button
                    type="button"
                    className="icon-btn danger"
                    onClick={() => removeItem('faqs', i)}
                  >
                    <Icon.Trash size={16} />
                  </button>
                </div>
                <input
                  className="input"
                  value={f.q}
                  onChange={(e) => updateItem('faqs', i, 'q', e.target.value)}
                  placeholder="Question"
                />
                <textarea
                  className="textarea"
                  style={{ minHeight: 80 }}
                  value={f.a}
                  onChange={(e) => updateItem('faqs', i, 'a', e.target.value)}
                  placeholder="Answer"
                />
              </div>
            ))}
            {form.faqs.length === 0 && (
              <p className="muted" style={{ padding: '10px 0' }}>
                No FAQs yet.
              </p>
            )}
          </div>

          {/* ------------------------------------------------ submit bar */}
          <div className="form-submit-bar">
            <Link to="/admin/dashboard" className="btn btn-ghost">
              Cancel
            </Link>
            <button type="submit" className="btn btn-green btn-lg" disabled={busy}>
              {busy ? (
                <>
                  <span className="btn-spin" /> Saving…
                </>
              ) : (
                <>
                  <Icon.Check size={19} />{' '}
                  {isEdit ? 'Save Changes' : 'Create Product'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
