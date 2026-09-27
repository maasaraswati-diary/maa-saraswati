import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/Icons';
import ProductImage from '../../components/ProductImage';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks';
import {
  createProduct,
  updateProduct,
  fetchAllProducts,
  saveProductImage,
} from '../../store/db';
import { getCategories } from '../../catalogue';
import { optimiseImage, prettyBytes } from '../../lib/imageOptimiser';
import { usePageMeta } from '../../hooks';

const ICON_CHOICES = [
  'drop', 'shield', 'nutrition', 'family', 'muscle',
  'bone', 'leaf', 'fire', 'snow', 'award', 'sparkle', 'truck',
];

const CATEGORIES = [
  'Milk', 'Milk & Beverages', 'Paneer & Cheese',
  'Curd & Cream', 'Butter & Ghee', 'Other',
];

const BLANK = {
  name: '', shortName: '', category: 'Milk',
  tagline: '', taglineEnglish: '',
  price: '', mrp: '', unit: 'pack', packSize: '', fat: '',
  veg: true, inStock: true, featured: false,
  rating: 4.5, reviewCount: 0, soldLabel: '',
  shortDescription: '', description: '',
  images: [], highlights: '', usage: '',
  features: [], nutrition: [], faqs: [],
};

const lines = (text) =>
  String(text || '').split('\n').map((s) => s.trim()).filter(Boolean);

/**
 * Add / edit a product. Saves go straight to Firestore, so no application
 * server is involved. New products and edited products are both sent to the
 * shop owner for approval.
 */
export default function PartnerProductForm() {
  const { id } = useParams();
  const isEdit = Boolean(id) && id !== 'new';
  const { user, isOwner } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  // After isEdit, not above it. Reading a const before its declaration is a
  // temporal dead zone error, which took the whole page down to a blank screen
  // rather than failing one line - the form was unusable and nothing said why.
  usePageMeta({
    title: isEdit ? 'Edit Product' : 'Add Product',
    description: 'Add or edit a product in the Maa Saraswati catalogue.',
    noIndex: true,
  });

  const [form, setForm] = useState(BLANK);
  const [texts, setTexts] = useState({ description: '', highlights: '', usage: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [loading, setLoading] = useState(isEdit);

  // Existing categories come from the live catalogue.
  const catData = useFetch(() => getCategories(), []);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    (async () => {
      try {
        const all = await fetchAllProducts();
        const p = all.find((x) => x.id === id);
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
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((x) => ({ ...x, [key]: undefined }));
  };
  const setText = (key) => (e) => setTexts((t) => ({ ...t, [key]: e.target.value }));

  const updateItem = (field, i, key, value) =>
    setForm((f) => {
      const next = [...f[field]];
      next[i] = { ...next[i], [key]: value };
      return { ...f, [field]: next };
    });
  const addItem = (field, blank) => setForm((f) => ({ ...f, [field]: [...f[field], blank] }));
  const removeItem = (field, i) =>
    setForm((f) => ({ ...f, [field]: f[field].filter((_, idx) => idx !== i) }));

  const addImagePath = () => {
    const v = window.prompt('Enter an image path or URL:', '/images/products/');
    if (v && v.trim()) setForm((f) => ({ ...f, images: [...f.images, v.trim()] }));
  };

  /**
   * Pick a picture from the computer. It is shrunk to WebP in the browser first,
   * so a 4 MB phone photo is stored as roughly 100 KB, then kept in Firestore.
   */
  const onPickFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // so the same file can be picked again after a delete
    if (!files.length) return;

    setUploading(true);
    const added = [];
    const problems = [];
    let before = 0;
    let after = 0;

    for (const file of files) {
      try {
        setUploadMsg(`${file.name} is being compressed…`);
        // eslint-disable-next-line no-await-in-loop
        const shot = await optimiseImage(file);
        setUploadMsg(
          `${file.name} is uploading (${prettyBytes(file.size)} → ${prettyBytes(shot.large.bytes)})`
        );
        // eslint-disable-next-line no-await-in-loop
        const ref = await saveProductImage(shot, user);
        added.push(ref);
        before += file.size;
        after += shot.large.bytes + shot.thumb.bytes;
      } catch (err) {
        problems.push(`${file.name}: ${err.message}`);
      }
    }

    if (added.length) {
      setForm((f) => ({ ...f, images: [...f.images, ...added] }));
      toast.success(
        `${added.length} image(s) added — ${prettyBytes(before)} reduced to ` +
          `${prettyBytes(after)} (${Math.round((1 - after / before) * 100)}% smaller)`
      );
    }
    if (problems.length) toast.error(problems.join(' | '));
    setUploadMsg('');
    setUploading(false);
  };

  const margin = useMemo(() => {
    const p = Number(form.price) || 0;
    const m = Number(form.mrp) || 0;
    if (!p || !m || m <= p) return null;
    return { amount: m - p, pct: Math.round(((m - p) / m) * 100) };
  }, [form.price, form.mrp]);

  const validate = () => {
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Please enter the product name.';
    if (!form.price || Number(form.price) <= 0) e.price = 'Enter the correct selling price.';
    if (form.mrp && Number(form.mrp) < Number(form.price))
      e.mrp = 'MRP cannot be lower than the selling price.';
    if (!form.images.length) e.images = 'Add at least one image.';
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
        await updateProduct(id, payload, isOwner);
        toast.success(isOwner
          ? 'Product updated.'
          : 'Updated. It has been sent for approval again.');
      } else {
        await createProduct(payload, user);
        toast.success('Product submitted! It goes live once the shop owner approves it.');
      }
      navigate('/partner/products');
    } catch (err) {
      toast.error(err.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <section className="admin-sec">
        <div className="container"><p className="muted" style={{ padding: 40 }}>Loading…</p></div>
      </section>
    );
  }

  return (
    <section className="admin-sec">
      <div className="container">
        <div className="admin-head">
          <div>
            <span className="eyebrow">
              <Link to="/partner/products">Partner Panel</Link> / Products
            </span>
            <h1 className="h2">{isEdit ? 'Edit Product' : 'Add New Product'}</h1>
          </div>
          <Link to="/partner/products" className="btn btn-ghost btn-sm">
            <Icon.ArrowLeft size={16} /> Back
          </Link>
        </div>

        <div className="notice notice-info" style={{ marginBottom: 20 }}>
          <Icon.Info size={18} />
          <div>
            <strong>The shop owner approves it after you save.</strong>
            <p>
              The product does not go live on the website straight away.
              Customers see it only after it is approved.
            </p>
          </div>
        </div>

        <form className="form-admin" onSubmit={submit} noValidate>
          {/* basics */}
          <div className="card form-card">
            <div className="admin-card-head">
              <h2 className="h3"><Icon.Tag size={19} /> Basic Details</h2>
            </div>

            <div className="form-row">
              <div className="field">
                <label className="label" htmlFor="name">Product Name <span className="req">*</span></label>
                <input id="name" className={`input ${errors.name ? 'err' : ''}`} value={form.name}
                  onChange={set('name')} placeholder="e.g. Fresh Paneer" />
                {errors.name && <span className="field-error"><Icon.Alert size={14} /> {errors.name}</span>}
              </div>
              <div className="field">
                <label className="label" htmlFor="shortName">Short Name</label>
                <input id="shortName" className="input" value={form.shortName}
                  onChange={set('shortName')} placeholder="e.g. Paneer" />
                <span className="hint">Shown on the product card.</span>
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label className="label" htmlFor="category">Category</label>
                <select id="category" className="select" value={form.category} onChange={set('category')}>
                  {(catData.data?.categories || CATEGORIES.map((n) => ({ name: n })))
                    .map((c) => c.name)
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label" htmlFor="packSize">Pack Size</label>
                <input id="packSize" className="input" value={form.packSize}
                  onChange={set('packSize')} placeholder="e.g. 200 g" />
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label className="label" htmlFor="tagline">Tagline (on pack)</label>
                <input id="tagline" className="input" value={form.tagline}
                  onChange={set('tagline')} placeholder="e.g. A promise of purity" />
              </div>
              <div className="field">
                <label className="label" htmlFor="taglineEnglish">Tagline (English)</label>
                <input id="taglineEnglish" className="input" value={form.taglineEnglish}
                  onChange={set('taglineEnglish')} placeholder="e.g. A promise of purity" />
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="shortDescription">Short Description</label>
              <textarea id="shortDescription" className="textarea" style={{ minHeight: 80 }}
                value={form.shortDescription} onChange={set('shortDescription')}
                placeholder="One line, shown on the card and the product page." />
            </div>

            <div className="field">
              <label className="label" htmlFor="description">Full Description</label>
              <textarea id="description" className="textarea" value={texts.description}
                onChange={setText('description')}
                placeholder="Each line becomes one paragraph." />
              <span className="hint">{lines(texts.description).length} paragraph(s)</span>
            </div>
          </div>

          {/* pricing */}
          <div className="card form-card">
            <div className="admin-card-head">
              <h2 className="h3"><Icon.Wallet size={19} /> Pricing &amp; Pack</h2>
            </div>

            <div className="form-row form-row-3">
              <div className="field">
                <label className="label" htmlFor="price">Selling Price (₹) <span className="req">*</span></label>
                <input id="price" type="number" min="0" className={`input ${errors.price ? 'err' : ''}`}
                  value={form.price} onChange={set('price')} placeholder="190" />
                {errors.price && <span className="field-error"><Icon.Alert size={14} /> {errors.price}</span>}
              </div>
              <div className="field">
                <label className="label" htmlFor="mrp">MRP (₹)</label>
                <input id="mrp" type="number" min="0" className={`input ${errors.mrp ? 'err' : ''}`}
                  value={form.mrp} onChange={set('mrp')} placeholder="210" />
                {errors.mrp && <span className="field-error"><Icon.Alert size={14} /> {errors.mrp}</span>}
              </div>
              <div className="field">
                <label className="label" htmlFor="unit">Unit</label>
                <input id="unit" className="input" value={form.unit} onChange={set('unit')}
                  placeholder="pouch / pack / tub" />
              </div>
            </div>

            {margin && (
              <div className="margin-note">
                <Icon.Tag size={16} />
                <span>Discount: <strong>{margin.pct}%</strong> (₹{margin.amount} off)</span>
              </div>
            )}

            <div className="form-row form-row-3">
              <div className="field">
                <label className="label" htmlFor="fat">Fat % (optional)</label>
                <input id="fat" className="input" value={form.fat} onChange={set('fat')} placeholder="4.5%" />
              </div>
              <div className="field">
                <label className="label" htmlFor="rating">Rating</label>
                <input id="rating" type="number" step="0.1" min="0" max="5" className="input"
                  value={form.rating} onChange={set('rating')} />
              </div>
              <div className="field">
                <label className="label" htmlFor="reviewCount">Review Count</label>
                <input id="reviewCount" type="number" min="0" className="input"
                  value={form.reviewCount} onChange={set('reviewCount')} />
              </div>
            </div>

            <div className="switch-row">
              <label className="checkbox">
                <input type="checkbox" checked={form.veg} onChange={set('veg')} /> 100% Vegetarian
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={form.inStock} onChange={set('inStock')} /> In stock
              </label>
              {isOwner && (
                <label className="checkbox">
                  <input type="checkbox" checked={form.featured} onChange={set('featured')} /> Featured / Bestseller
                </label>
              )}
            </div>
          </div>

          {/* images */}
          <div className="card form-card">
            <div className="admin-card-head">
              <h2 className="h3"><Icon.Upload size={19} /> Product Images</h2>
            </div>

            {errors.images && (
              <span className="field-error" style={{ marginBottom: 12 }}>
                <Icon.Alert size={14} /> {errors.images}
              </span>
            )}

            <div className="img-upload-row">
              <label className="btn btn-brand btn-sm upload-btn">
                <Icon.Upload size={15} />
                {uploading ? 'Uploading…' : 'Choose an image from your computer'}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={onPickFiles}
                  disabled={uploading}
                  hidden
                />
              </label>

              <button type="button" className="btn btn-ghost btn-sm" onClick={addImagePath}>
                <Icon.Plus size={15} /> Enter a path
              </button>

              <span className="hint">
                {uploadMsg ||
                  'Choose a photo — it is compressed for you and goes live the same way.'}
              </span>
            </div>

            <div className="img-list">
              {form.images.map((src, i) => (
                <div key={src + i} className="img-item">
                  <ProductImage
                    src={src}
                    alt=""
                    loading="lazy"
                    preferThumb
                    onError={() => removeItem('images', i)}
                  />
                  {i === 0 && <span className="badge badge-brand img-main">Main</span>}
                  <div className="img-item-tools">
                    <button type="button" className="icon-btn" disabled={i === 0}
                      onClick={() => setForm((f) => {
                        const next = [...f.images];
                        [next[i - 1], next[i]] = [next[i], next[i - 1]];
                        return { ...f, images: next };
                      })} title="Move earlier">
                      <Icon.ArrowLeft size={15} />
                    </button>
                    <button type="button" className="icon-btn danger"
                      onClick={() => removeItem('images', i)} title="Remove">
                      <Icon.Trash size={15} />
                    </button>
                  </div>
                </div>
              ))}
              {form.images.length === 0 && (
                <p className="muted" style={{ padding: 14 }}>No images yet.</p>
              )}
            </div>
          </div>

          {/* highlights + usage */}
          <div className="card form-card">
            <div className="admin-card-head">
              <h2 className="h3"><Icon.CheckCircle size={19} /> Highlights &amp; Usage</h2>
            </div>
            <div className="form-row">
              <div className="field">
                <label className="label" htmlFor="highlights">Highlights (one per line)</label>
                <textarea id="highlights" className="textarea" style={{ minHeight: 100 }}
                  value={texts.highlights} onChange={setText('highlights')}
                  placeholder={'100% Pure Milk\nFrom healthy cows\nQuality you trust'} />
              </div>
              <div className="field">
                <label className="label" htmlFor="usage">Best used in (one per line)</label>
                <textarea id="usage" className="textarea" style={{ minHeight: 100 }}
                  value={texts.usage} onChange={setText('usage')}
                  placeholder={'Tea and coffee\nCurd and paneer at home'} />
              </div>
            </div>
          </div>

          {/* nutrition */}
          <div className="card form-card">
            <div className="admin-card-head">
              <h2 className="h3"><Icon.Nutrient size={19} /> Nutrition Facts</h2>
              <button type="button" className="btn btn-ghost btn-sm"
                onClick={() => addItem('nutrition', { label: '', value: '', per: 'per 100 g' })}>
                <Icon.Plus size={15} /> Add Row
              </button>
            </div>
            {form.nutrition.map((n, i) => (
              <div key={i} className="dyn-row">
                <input className="input" placeholder="Label (e.g. Protein)" value={n.label}
                  onChange={(e) => updateItem('nutrition', i, 'label', e.target.value)} />
                <input className="input" placeholder="Value (e.g. 18 g)" value={n.value}
                  onChange={(e) => updateItem('nutrition', i, 'value', e.target.value)} />
                <input className="input" placeholder="Per (e.g. per 100 g)" value={n.per}
                  onChange={(e) => updateItem('nutrition', i, 'per', e.target.value)} />
                <button type="button" className="icon-btn danger"
                  onClick={() => removeItem('nutrition', i)}>
                  <Icon.Trash size={16} />
                </button>
              </div>
            ))}
            {form.nutrition.length === 0 && (
              <p className="muted" style={{ padding: '10px 0' }}>No rows yet.</p>
            )}
          </div>

          {/* features */}
          <div className="card form-card">
            <div className="admin-card-head">
              <h2 className="h3"><Icon.Sparkle size={19} /> Feature Cards</h2>
              <button type="button" className="btn btn-ghost btn-sm"
                onClick={() => addItem('features', { icon: 'drop', title: '', text: '' })}>
                <Icon.Plus size={15} /> Add Feature
              </button>
            </div>
            {form.features.map((f, i) => (
              <div key={i} className="dyn-block">
                <div className="dyn-block-head">
                  <span className="badge">Feature {i + 1}</span>
                  <button type="button" className="icon-btn danger"
                    onClick={() => removeItem('features', i)}>
                    <Icon.Trash size={16} />
                  </button>
                </div>
                <div className="form-row form-row-3">
                  <div className="field">
                    <label className="label">Icon</label>
                    <select className="select" value={f.icon}
                      onChange={(e) => updateItem('features', i, 'icon', e.target.value)}>
                      {ICON_CHOICES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label className="label">Title</label>
                    <input className="input" value={f.title}
                      onChange={(e) => updateItem('features', i, 'title', e.target.value)}
                      placeholder="e.g. 100% Pure Milk" />
                  </div>
                  <div className="field">
                    <label className="label">Text</label>
                    <input className="input" value={f.text}
                      onChange={(e) => updateItem('features', i, 'text', e.target.value)}
                      placeholder="Short supporting line" />
                  </div>
                </div>
              </div>
            ))}
            {form.features.length === 0 && (
              <p className="muted" style={{ padding: '10px 0' }}>No features yet.</p>
            )}
          </div>

          {/* faqs */}
          <div className="card form-card">
            <div className="admin-card-head">
              <h2 className="h3"><Icon.Info size={19} /> FAQs</h2>
              <button type="button" className="btn btn-ghost btn-sm"
                onClick={() => addItem('faqs', { q: '', a: '' })}>
                <Icon.Plus size={15} /> Add Question
              </button>
            </div>
            {form.faqs.map((f, i) => (
              <div key={i} className="dyn-block">
                <div className="dyn-block-head">
                  <span className="badge">Question {i + 1}</span>
                  <button type="button" className="icon-btn danger"
                    onClick={() => removeItem('faqs', i)}>
                    <Icon.Trash size={16} />
                  </button>
                </div>
                <input className="input" value={f.q}
                  onChange={(e) => updateItem('faqs', i, 'q', e.target.value)} placeholder="Question" />
                <textarea className="textarea" style={{ minHeight: 80 }} value={f.a}
                  onChange={(e) => updateItem('faqs', i, 'a', e.target.value)} placeholder="Answer" />
              </div>
            ))}
            {form.faqs.length === 0 && (
              <p className="muted" style={{ padding: '10px 0' }}>No questions yet.</p>
            )}
          </div>

          <div className="form-submit-bar">
            <Link to="/partner/products" className="btn btn-ghost">Cancel</Link>
            <button type="submit" className="btn btn-green btn-lg" disabled={busy}>
              {busy ? (<><span className="btn-spin" /> Saving…</>)
                : (<><Icon.Check size={19} /> {isEdit ? 'Save Changes' : 'Submit for Approval'}</>)}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
