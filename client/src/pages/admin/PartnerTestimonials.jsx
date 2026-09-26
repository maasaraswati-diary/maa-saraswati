import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icons';
import { useToast } from '../../components/Toast';
import { useFetch } from '../../hooks';
import {
  fetchTestimonials,
  createTestimonial,
  updateTestimonial,
  removeTestimonial,
} from '../../store/db';

const BLANK = { name: '', role: '', text: '', rating: 5, sortOrder: 0 };

/**
 * Owner-only. Customer stories shown on the home page are managed from here,
 * so the site can be updated without touching any code.
 */
export default function PartnerTestimonials() {
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => fetchTestimonials(), []);

  const [editing, setEditing] = useState(null); // null | 'new' | testimonial
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});

  const list = data || [];

  const startNew = () => {
    setForm({ ...BLANK, sortOrder: list.length });
    setErrors({});
    setEditing('new');
  };

  const startEdit = (t) => {
    setForm({
      name: t.name || '',
      role: t.role || '',
      text: t.text || '',
      rating: Number(t.rating) || 5,
      sortOrder: Number(t.sortOrder) || 0,
    });
    setErrors({});
    setEditing(t);
  };

  const set = (key) => (e) => {
    const value =
      e.target.type === 'number' || e.target.type === 'range'
        ? Number(e.target.value)
        : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((x) => ({ ...x, [key]: undefined }));
  };

  const save = async (ev) => {
    ev.preventDefault();
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Customer ka naam likhein.';
    if (form.text.trim().length < 10) e.text = 'Review thodi lambi honi chahiye.';
    if (form.text.trim().length > 600) e.text = '600 characters se kam rakhein.';
    setErrors(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      if (editing === 'new') {
        await createTestimonial(form);
        toast.success('Review add ho gayi — home page par dikh rahi hai.');
      } else {
        await updateTestimonial(editing.id, form);
        toast.success('Review update ho gayi.');
      }
      setEditing(null);
      reload();
    } catch (err) {
      toast.error(
        /permission|denied/i.test(err?.message || '')
          ? 'Sirf shop owner hi review change kar sakta hai.'
          : err?.message || 'Save nahi ho paya.'
      );
    } finally {
      setBusy(false);
    }
  };

  const del = async (t) => {
    if (!window.confirm(`"${t.name}" ki review hatani hai?`)) return;
    try {
      await removeTestimonial(t.id);
      toast.success('Review hat gayi.');
      reload();
    } catch (err) {
      toast.error(err?.message || 'Delete nahi ho paya.');
    }
  };

  const move = async (t, dir) => {
    const next = [...list];
    const i = next.findIndex((x) => x.id === t.id);
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    try {
      await Promise.all(
        next.map((x, idx) => updateTestimonial(x.id, { sortOrder: idx }))
      );
      reload();
    } catch (err) {
      toast.error(err?.message || 'Order change nahi hua.');
    }
  };

  return (
    <section className="admin-sec">
      <div className="container">
        <div className="admin-head">
          <div>
            <span className="eyebrow">
              <Link to="/partner/products">Partner Panel</Link> / Testimonials
            </span>
            <h1 className="h2">Customer Reviews</h1>
            <p className="muted" style={{ marginTop: 6 }}>
              {list.length} review{list.length === 1 ? '' : 's'} live
              {list.length > 3 && ' — home page par slider chalega'}
            </p>
          </div>
          {!editing && (
            <button type="button" className="btn btn-brand btn-sm" onClick={startNew}>
              <Icon.Plus size={16} /> Add Review
            </button>
          )}
        </div>

        {editing && (
          <form className="card form-card" onSubmit={save} style={{ marginBottom: 20 }}>
            <div className="admin-card-head">
              <h2 className="h3">
                <Icon.Sparkle size={19} />
                {editing === 'new' ? 'New Review' : 'Edit Review'}
              </h2>
            </div>

            <div className="form-row">
              <div className="field">
                <label className="label" htmlFor="tname">
                  Customer Name <span className="req">*</span>
                </label>
                <input
                  id="tname"
                  className={`input ${errors.name ? 'err' : ''}`}
                  value={form.name}
                  onChange={set('name')}
                  placeholder="e.g. Rahul"
                />
                {errors.name && (
                  <span className="field-error">
                    <Icon.Alert size={14} /> {errors.name}
                  </span>
                )}
              </div>
              <div className="field">
                <label className="label" htmlFor="trole">Customer / Shop</label>
                <input
                  id="trole"
                  className="input"
                  value={form.role}
                  onChange={set('role')}
                  placeholder="e.g. Customer since 2011"
                />
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="ttext">
                Review <span className="req">*</span>
              </label>
              <textarea
                id="ttext"
                className={`textarea ${errors.text ? 'err' : ''}`}
                style={{ minHeight: 110 }}
                value={form.text}
                onChange={set('text')}
                placeholder="Customer ne kya kaha — aapki hi bhasha me likhein."
              />
              <div className="row-between">
                {errors.text ? (
                  <span className="field-error">
                    <Icon.Alert size={14} /> {errors.text}
                  </span>
                ) : (
                  <span className="hint">Zyada se zyada 600 characters.</span>
                )}
                <span className="hint">{form.text.trim().length}/600</span>
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label className="label" htmlFor="trating">Rating</label>
                <select
                  id="trating"
                  className="select"
                  value={form.rating}
                  onChange={set('rating')}
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {'★'.repeat(n)} ({n})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="label" htmlFor="torder">Position</label>
                <input
                  id="torder"
                  type="number"
                  min="0"
                  className="input"
                  value={form.sortOrder}
                  onChange={set('sortOrder')}
                />
                <span className="hint">0 = sabse pehle dikhegi.</span>
              </div>
            </div>

            <div className="form-submit-bar" style={{ boxShadow: 'none', padding: '14px 0 0' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-green" disabled={busy}>
                {busy ? 'Saving…' : editing === 'new' ? 'Add Review' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}

        {loading && <p className="muted" style={{ padding: 20 }}>Loading…</p>}

        {!loading && error && (
          <div className="error-state">
            <span className="error-icon">
              <Icon.Alert size={26} />
            </span>
            <h3 className="h3">Reviews load nahi hui</h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={reload}>
              <Icon.Refresh size={15} /> Dobara try karein
            </button>
          </div>
        )}

        {!loading && !error && list.length === 0 && !editing ? (
          <div className="error-state">
            <span className="error-icon empty-icon">
              <Icon.Sparkle size={28} />
            </span>
            <h3 className="h3">Abhi koi review nahi</h3>
            <p className="muted">
              Customer ki pehli review add karein — wo turant home page par
              dikhne lagegi.
            </p>
            <button type="button" className="btn btn-brand btn-sm" onClick={startNew}>
              <Icon.Plus size={15} /> Add your first review
            </button>
          </div>
        ) : (
          list.length > 0 && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Review</th>
                    <th>Rating</th>
                    <th className="ta-right">Order</th>
                    <th className="ta-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((t, i) => (
                    <tr key={t.id}>
                      <td>
                        <div className="cell-product">
                          <span className="quote-avatar">
                            {String(t.name || '?')
                              .split(' ')
                              .map((w) => w[0])
                              .slice(0, 2)
                              .join('')}
                          </span>
                          <div>
                            <strong>{t.name}</strong>
                            <span className="muted">{t.role || '—'}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="tst-cell-text">{t.text}</span>
                      </td>
                      <td>
                        <span className="badge badge-gold">
                          {'★'.repeat(Number(t.rating) || 5)}
                        </span>
                      </td>
                      <td className="ta-right">
                        <div className="row-actions">
                          <button
                            className="icon-btn"
                            onClick={() => move(t, -1)}
                            disabled={i === 0}
                            title="Move earlier"
                          >
                            <Icon.ArrowLeft size={15} />
                          </button>
                          <button
                            className="icon-btn"
                            onClick={() => move(t, 1)}
                            disabled={i === list.length - 1}
                            title="Move later"
                          >
                            <Icon.ArrowRight size={15} />
                          </button>
                        </div>
                      </td>
                      <td className="ta-right">
                        <div className="row-actions">
                          <button
                            className="icon-btn"
                            onClick={() => startEdit(t)}
                            title="Edit"
                          >
                            <Icon.Edit size={16} />
                          </button>
                          <button
                            className="icon-btn danger"
                            onClick={() => del(t)}
                            title="Delete"
                          >
                            <Icon.Trash size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {list.length > 3 && (
          <div className="notice notice-info" style={{ marginTop: 18 }}>
            <Icon.Info size={18} />
            <div>
              <strong>{list.length} reviews — slider on</strong>
              <p>
                3 se zyada reviews hone par home page par slider aa jata hai,
                taaki ek saath sab dikhne na lagay.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
