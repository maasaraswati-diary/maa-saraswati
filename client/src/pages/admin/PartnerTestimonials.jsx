import { useState } from 'react';
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
 * Owner-only. The customer stories shown on the home page, managed in place
 * inside the Reviews tab of the partner panel so it behaves exactly like the
 * Products and Enquiries tabs.
 */
export default function TestimonialsPanel() {
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
    if (form.name.trim().length < 2) e.name = 'Enter the customer name.';
    if (form.text.trim().length < 10) e.text = 'Please write a slightly longer review.';
    if (form.text.trim().length > 600) e.text = 'Please keep it under 600 characters.';
    setErrors(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      if (editing === 'new') {
        await createTestimonial(form);
        toast.success('Review added — it is now on the home page.');
      } else {
        await updateTestimonial(editing.id, form);
        toast.success('Review updated.');
      }
      setEditing(null);
      reload();
    } catch (err) {
      toast.error(
        /permission|insufficient/i.test(err?.message || '')
          ? 'Only the shop owner can change a review.'
          : err?.message || 'Could not save.'
      );
    } finally {
      setBusy(false);
    }
  };

  const del = async (t) => {
    if (!window.confirm(`Delete the review from "${t.name}"?`)) return;
    try {
      await removeTestimonial(t.id);
      toast.success('Review deleted.');
      reload();
    } catch (err) {
      toast.error(err?.message || 'Could not delete.');
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
      toast.error(err?.message || 'Could not change the order.');
    }
  };

  return (
    <div className="tst-panel">
      <div className="admin-toolbar">
        <p className="muted" style={{ margin: 0 }}>
          {loading
            ? 'Loading reviews…'
            : `${list.length} review${list.length === 1 ? '' : 's'} live${
                list.length > 3 ? ' — the home page will show a slider' : ''
              }`}
        </p>
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
              {editing === 'new' ? 'New review' : `Editing: ${editing.name}`}
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
              placeholder="What the customer said, written in your own words."
            />
            <div className="row-between">
              {errors.text ? (
                <span className="field-error">
                  <Icon.Alert size={14} /> {errors.text}
                </span>
              ) : (
                <span className="hint">Up to 600 characters.</span>
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
              <span className="hint">0 shows it first.</span>
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
              {busy
                ? 'Saving…'
                : editing === 'new'
                  ? 'Add Review'
                  : 'Save Changes'}
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
          <h3 className="h3">Reviews could not be loaded</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={reload}>
            <Icon.Refresh size={15} /> Try again
          </button>
        </div>
      )}

      {!loading && !error && list.length === 0 && !editing ? (
        <div className="error-state">
          <span className="error-icon empty-icon">
            <Icon.Sparkle size={28} />
          </span>
          <h3 className="h3">No reviews yet</h3>
          <p className="muted">
            Add your first customer review — it will appear on the home page
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
  );
}
