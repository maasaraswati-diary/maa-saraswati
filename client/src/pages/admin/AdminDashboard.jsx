import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icons';
import { useToast } from '../../components/Toast';
import { api, clearToken, formatPrice } from '../../api';
import { useFetch } from '../../hooks';

const TABS = [
  { key: 'overview', label: 'Overview', icon: 'Chart' },
  { key: 'products', label: 'Products', icon: 'Grid' },
  { key: 'enquiries', label: 'Enquiries', icon: 'Inbox' },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const [query, setQuery] = useState('');
  const [confirmId, setConfirmId] = useState(null);

  const stats = useFetch(() => api.admin.stats(), []);
  const products = useFetch(() => api.admin.getProducts(), []);
  const enquiries = useFetch(() => api.admin.getEnquiries(), []);

  const all = products.data?.products || [];
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((p) =>
      [p.name, p.category, p.slug].some((f) =>
        String(f || '').toLowerCase().includes(q)
      )
    );
  }, [all, query]);

  const logout = () => {
    clearToken();
    toast.info('You have been signed out.');
    navigate('/admin', { replace: true });
  };

  const remove = async (id, name) => {
    try {
      await api.admin.deleteProduct(id);
      toast.success(`“${name}” was deleted.`);
      setConfirmId(null);
      products.reload();
      stats.reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleStock = async (p) => {
    try {
      await api.admin.updateProduct(p.id, { ...p, inStock: !p.inStock });
      toast.success(
        `${p.shortName || p.name} marked ${p.inStock ? 'out of stock' : 'back in stock'}.`
      );
      products.reload();
      stats.reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const setEnquiryStatus = async (id, status) => {
    try {
      await api.admin.updateEnquiry(id, status);
      enquiries.reload();
      stats.reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const deleteEnquiry = async (id) => {
    try {
      await api.admin.deleteEnquiry(id);
      toast.success('Enquiry deleted.');
      enquiries.reload();
      stats.reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const s = stats.data || {};
  const enqList = enquiries.data?.enquiries || [];

  return (
    <section className="admin-sec">
      <div className="container">
        {/* Header */}
        <div className="admin-head">
          <div>
            <span className="eyebrow">Admin Panel</span>
            <h1 className="h2">Dashboard</h1>
          </div>
          <div className="admin-head-actions">
            <Link to="/" className="btn btn-ghost btn-sm">
              <Icon.Globe size={16} /> View Website
            </Link>
            <button className="btn btn-ghost btn-sm" onClick={logout}>
              <Icon.LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-4 admin-stats">
          {[
            {
              icon: 'Grid',
              label: 'Total products',
              value: s.totalProducts ?? '—',
            },
            {
              icon: 'Sparkle',
              label: 'Featured',
              value: s.featuredProducts ?? '—',
            },
            {
              icon: 'Inbox',
              label: 'New enquiries',
              value: s.newEnquiries ?? '—',
            },
            {
              icon: 'Alert',
              label: 'Out of stock',
              value: s.outOfStock ?? '—',
            },
          ].map((c, i) => {
            const I = Icon[c.icon];
            return (
              <div
                key={c.label}
                className={`stat-card reveal reveal-d${i + 1}`}
              >
                <span className="stat-ic">
                  <I size={21} />
                </span>
                <div>
                  <strong className="stat-value">{c.value}</strong>
                  <span className="stat-label">{c.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <div className="admin-tabs">
          {TABS.map((t) => {
            const I = Icon[t.icon];
            return (
              <button
                key={t.key}
                className={`admin-tab ${tab === t.key ? 'active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                <I size={17} /> {t.label}
                {t.key === 'enquiries' && s.newEnquiries > 0 && (
                  <span className="admin-badge">{s.newEnquiries}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ---------------------------------------------- OVERVIEW */}
        {tab === 'overview' && (
          <div className="admin-pane">
            <div className="grid grid-2 admin-overview">
              <div className="card admin-card">
                <div className="admin-card-head">
                  <h2 className="h3">Latest enquiries</h2>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setTab('enquiries')}
                  >
                    View all <Icon.ArrowRight size={15} />
                  </button>
                </div>
                <ul className="mini-list">
                  {enqList.slice(0, 5).map((e) => (
                    <li key={e.id}>
                      <span className={`dot-status ${e.status}`} />
                      <div className="mini-main">
                        <strong>{e.name}</strong>
                        <span className="muted">{e.subject}</span>
                      </div>
                      <span className="mini-date">
                        {new Date(e.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </span>
                    </li>
                  ))}
                  {enqList.length === 0 && (
                    <li className="muted" style={{ padding: '14px 0' }}>
                      No enquiries yet.
                    </li>
                  )}
                </ul>
              </div>

              <div className="card admin-card">
                <div className="admin-card-head">
                  <h2 className="h3">Top products by rating</h2>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setTab('products')}
                  >
                    Manage <Icon.ArrowRight size={15} />
                  </button>
                </div>
                <ul className="mini-list">
                  {[...all]
                    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
                    .slice(0, 5)
                    .map((p) => (
                      <li key={p.id}>
                        <img
                          className="mini-thumb"
                          src={p.images?.[0]}
                          alt=""
                        />
                        <div className="mini-main">
                          <strong>{p.shortName || p.name}</strong>
                          <span className="muted">{p.category}</span>
                        </div>
                        <span className="mini-rate">
                          <Icon.Star size={13} /> {p.rating}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------- PRODUCTS */}
        {tab === 'products' && (
          <div className="admin-pane">
            <div className="admin-toolbar">
              <div className="search-box">
                <Icon.Search size={18} className="search-icon" />
                <input
                  className="search-input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search products…"
                />
              </div>
              <Link to="/admin/products/new" className="btn btn-red btn-sm">
                <Icon.Plus size={16} /> Add Product
              </Link>
            </div>

            {products.loading && (
              <p className="muted" style={{ padding: 20 }}>
                Loading products…
              </p>
            )}

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th className="ta-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="cell-product">
                          <img src={p.images?.[0]} alt="" className="cell-img" />
                          <div>
                            <strong>{p.shortName || p.name}</strong>
                            <span className="muted">/{p.slug}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge">{p.category}</span>
                      </td>
                      <td>
                        <strong>{formatPrice(p.price)}</strong>
                        {p.packSize && (
                          <span className="muted" style={{ display: 'block' }}>
                            {p.packSize}
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          className={`stock-toggle ${p.inStock ? 'in' : 'out'}`}
                          onClick={() => toggleStock(p)}
                          title="Toggle stock status"
                        >
                          {p.inStock ? 'In stock' : 'Out of stock'}
                        </button>
                      </td>
                      <td className="ta-right">
                        <div className="row-actions">
                          <Link
                            to={`/products/${p.slug}`}
                            className="icon-btn"
                            title="View on site"
                          >
                            <Icon.Search size={16} />
                          </Link>
                          <Link
                            to={`/admin/products/${p.id}`}
                            className="icon-btn"
                            title="Edit"
                          >
                            <Icon.Edit size={16} />
                          </Link>
                          {confirmId === p.id ? (
                            <span className="confirm-inline">
                              <button
                                className="icon-btn danger"
                                onClick={() => remove(p.id, p.name)}
                                title="Confirm delete"
                              >
                                <Icon.Check size={16} />
                              </button>
                              <button
                                className="icon-btn"
                                onClick={() => setConfirmId(null)}
                                title="Cancel"
                              >
                                <Icon.X size={16} />
                              </button>
                            </span>
                          ) : (
                            <button
                              className="icon-btn danger"
                              onClick={() => setConfirmId(p.id)}
                              title="Delete"
                            >
                              <Icon.Trash size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {list.length === 0 && !products.loading && (
                    <tr>
                      <td colSpan="5" className="ta-center muted">
                        No products match “{query}”.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ---------------------------------------------- ENQUIRIES */}
        {tab === 'enquiries' && (
          <div className="admin-pane">
            {enquiries.loading && (
              <p className="muted" style={{ padding: 20 }}>
                Loading enquiries…
              </p>
            )}

            {enqList.length === 0 && !enquiries.loading ? (
              <div className="error-state">
                <span className="error-icon empty-icon">
                  <Icon.Inbox size={28} />
                </span>
                <h3 className="h3">No enquiries yet</h3>
                <p className="muted">
                  Enquiries sent from the contact form will appear here.
                </p>
              </div>
            ) : (
              <div className="enq-admin-list">
                {enqList.map((e) => (
                  <article key={e.id} className={`enq-card ${e.status}`}>
                    <div className="enq-card-head">
                      <div className="cell-product">
                        <span className="enq-avatar">
                          {e.name
                            .split(' ')
                            .map((w) => w[0])
                            .slice(0, 2)
                            .join('')}
                        </span>
                        <div>
                          <strong>{e.name}</strong>
                          <span className="muted">
                            {new Date(e.createdAt).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                      <span className={`badge enq-status-${e.status}`}>
                        {e.status}
                      </span>
                    </div>

                    <p className="enq-subject">
                      <Icon.Tag size={15} /> {e.subject}
                    </p>
                    {e.product && (
                      <p className="muted enq-product">
                        Product: {e.product}
                      </p>
                    )}
                    <p className="enq-msg">{e.message}</p>

                    <div className="enq-card-foot">
                      <div className="enq-contact">
                        <a href={`tel:${e.phone}`}>
                          <Icon.Phone size={14} /> {e.phone || 'no phone'}
                        </a>
                        <a href={`mailto:${e.email}`}>
                          <Icon.Mail size={14} /> {e.email}
                        </a>
                      </div>
                      <div className="enq-actions">
                        {e.status !== 'contacted' && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setEnquiryStatus(e.id, 'contacted')}
                          >
                            <Icon.Check size={15} /> Mark contacted
                          </button>
                        )}
                        {e.status !== 'closed' && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setEnquiryStatus(e.id, 'closed')}
                          >
                            Close
                          </button>
                        )}
                        <button
                          className="icon-btn danger"
                          onClick={() => deleteEnquiry(e.id)}
                          title="Delete enquiry"
                        >
                          <Icon.Trash size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
