import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icons';
import TestimonialsPanel from './PartnerTestimonials';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks';
import {
  fetchProductsByOwner,
  fetchAllProducts,
  fetchEnquiries,
  removeProduct,
  setProductInStock,
  setEnquiryStatus,
  removeEnquiry,
  approveProduct,
  rejectProduct,
} from '../../store/db';
import { formatPrice } from '../../api';

const TABS = [
  { key: 'products', label: 'My Products', icon: 'Grid' },
  { key: 'approvals', label: 'Approvals', icon: 'Check', ownerOnly: true },
  { key: 'testimonials', label: 'Reviews', icon: 'Sparkle', ownerOnly: true },
  { key: 'enquiries', label: 'Enquiries', icon: 'Inbox', ownerOnly: true },
];

const STATUS_BADGE = {
  approved: { cls: 'badge', label: 'Live' },
  pending: { cls: 'badge badge-gold', label: 'Awaiting approval' },
  rejected: { cls: 'badge badge-red', label: 'Sent back' },
};

function StatusBadge({ status }) {
  const s = STATUS_BADGE[status] || STATUS_BADGE.approved;
  return <span className={s.cls}>{s.label}</span>;
}

export default function PartnerDashboard() {
  const { user, isOwner, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const toast = useToast();

  // The open tab lives in the URL, so Reviews (and anything else) can be linked
  // to directly and survives a refresh.
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab') || 'products';
  const [query, setQuery] = useState('');
  const [confirmId, setConfirmId] = useState(null);

  const tabs = TABS.filter((t) => !t.ownerOnly || isOwner);
  const tab = tabs.some((t) => t.key === tabParam) ? tabParam : 'products';
  const setTab = (key) => setParams(key === 'products' ? {} : { tab: key });

  const mine = useFetch(
    () => (isOwner ? fetchAllProducts() : fetchProductsByOwner(user.email)),
    // Coming back from the add/edit form must re-read, otherwise the table
    // still shows the values from before the save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.email, isOwner, pathname, search]
  );
  const enqs = useFetch(() => (isOwner ? fetchEnquiries() : Promise.resolve([])), [isOwner]);

  const list = useMemo(() => {
    const all = mine.data || [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((p) =>
      [p.name, p.category, p.slug].some((f) =>
        String(f || '').toLowerCase().includes(q)
      )
    );
  }, [mine.data, query]);

  const enqList = enqs.data || [];
  const pending = (mine.data || []).filter((p) => p.status === 'pending');
  const shown = tab === 'approvals' && isOwner ? pending : list;

  const logout = async () => {
    await signOut();
    toast.info('You have been signed out.');
    navigate('/partner', { replace: true });
  };

  const del = async (p) => {
    try {
      await removeProduct(p.id);
      toast.success(`“${p.name}” deleted.`);
      setConfirmId(null);
      mine.reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const toggleStock = async (p) => {
    try {
      await setProductInStock(p.id, p.inStock === false);
      toast.success(
        `${p.shortName || p.name} marked ${p.inStock ? 'out of stock' : 'back in stock'}.`
      );
      mine.reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const totalValue = list.reduce((s, p) => s + (Number(p.price) || 0), 0);

  return (
    <section className="admin-sec">
      <div className="container">
        <div className="admin-head">
          <div>
            <span className="eyebrow">Partner Panel</span>
            <h1 className="h2">
              {isOwner ? 'All Products' : 'My Products'}
            </h1>
            <p className="muted" style={{ marginTop: 6 }}>
              Signed in as <strong>{user?.email}</strong>
              {isOwner && <span className="badge badge-gold" style={{ marginLeft: 10 }}>OWNER</span>}
            </p>
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

        <div className="grid grid-4 admin-stats">
          {[
            { icon: 'Grid', label: isOwner ? 'All products' : 'My products', value: (mine.data || []).length },
            { icon: 'Tag', label: 'Listed value', value: formatPrice(totalValue) },
            { icon: 'Check', label: 'In stock', value: (mine.data || []).filter((p) => p.inStock !== false).length },
            { icon: 'Inbox', label: 'New enquiries', value: enqList.filter((e) => e.status === 'new').length },
          ].map((c, i) => {
            const I = Icon[c.icon];
            return (
              <div key={c.label} className={`stat-card reveal reveal-d${i + 1}`}>
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

        <div className="admin-tabs">
          {tabs.map((t) => {
            const I = Icon[t.icon];
            return (
              <button
                key={t.key}
                className={`admin-tab ${tab === t.key ? 'active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                <I size={17} /> {t.label}
                {t.key === 'approvals' && pending.length > 0 && (
                  <span className="admin-badge">{pending.length}</span>
                )}
                {t.key === 'enquiries' && enqList.filter((e) => e.status === 'new').length > 0 && (
                  <span className="admin-badge">
                    {enqList.filter((e) => e.status === 'new').length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {(tab === 'products' || (tab === 'approvals' && isOwner)) && (
          <div className="admin-pane">
            {tab === 'approvals' && (
              <div className="notice notice-info" style={{ marginBottom: 18 }}>
                <Icon.CheckCircle size={18} />
                <div>
                  <strong>
                    {pending.length} product{pending.length === 1 ? '' : 's'} waiting
                    for your approval
                  </strong>
                  <p>
                    Approve karte hi wo website par live ho jayega. Reject karne
                    par customer ko aapka note dikhega.
                  </p>
                </div>
              </div>
            )}

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
              <Link to="/partner/products/new" className="btn btn-brand btn-sm">
                <Icon.Plus size={16} /> Add Product
              </Link>
            </div>

            {mine.loading && <p className="muted" style={{ padding: 20 }}>Loading…</p>}

            {!mine.loading && shown.length === 0 ? (
              <div className="error-state">
                <span className="error-icon empty-icon">
                  <Icon.Grid size={28} />
                </span>
                <h3 className="h3">
                  {tab === 'approvals' ? 'Koi product approval ke liye nahi hai' : 'Abhi koi product nahi hai'}
                </h3>
                <p className="muted">
                  {tab === 'approvals'
                    ? 'Sab kuch review ho chuka hai. Naya product aate hi yahan dikhega.'
                    : 'Apna pehla product add karein — approval ke baad wo website par live ho jayega.'}
                </p>
                {tab !== 'approvals' && (
                  <Link to="/partner/products/new" className="btn btn-brand btn-sm">
                    <Icon.Plus size={15} /> Add your first product
                  </Link>
                )}
              </div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Status</th>
                      <th>Stock</th>
                      <th className="ta-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div className="cell-product">
                            <img src={p.image} alt="" className="cell-img" loading="lazy" />
                            <div>
                              <strong>{p.shortName || p.name}</strong>
                              <span className="muted">
                                {isOwner && p.ownerEmail ? `${p.ownerEmail} · ` : ''}/{p.slug}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td><span className="badge">{p.category}</span></td>
                        <td>
                          <strong>{formatPrice(p.price)}</strong>
                          {p.packSize && <span className="muted" style={{ display: 'block' }}>{p.packSize}</span>}
                        </td>
                        <td>
                          <StatusBadge status={p.status} />
                          {p.reviewNote && (
                            <span className="muted review-note" title={p.reviewNote}>
                              {p.reviewNote}
                            </span>
                          )}
                        </td>
                        <td>
                          <button
                            className={`stock-toggle ${p.inStock !== false ? 'in' : 'out'}`}
                            onClick={() => toggleStock(p)}
                            title="Toggle stock status"
                          >
                            {p.inStock !== false ? 'In stock' : 'Out of stock'}
                          </button>
                        </td>
                        <td className="ta-right">
                          <div className="row-actions">
                            {isOwner && p.status === 'pending' && (
                              <>
                                <button
                                  className="btn btn-green btn-sm"
                                  onClick={() =>
                                    approveProduct(p.id)
                                      .then(() => {
                                        toast.success(`“${p.name}” is now live.`);
                                        mine.reload();
                                      })
                                      .catch((e) => toast.error(e.message))
                                  }
                                  title="Approve and publish"
                                >
                                  <Icon.Check size={15} /> Approve
                                </button>
                                <button
                                  className="icon-btn danger"
                                  onClick={() => {
                                    const note = window.prompt(
                                      'Customer ko kya batana hai? (wajah likhein)',
                                      'Details theek karne ke baad dobara bhejein.'
                                    );
                                    if (note === null) return;
                                    rejectProduct(p.id, note || 'Rejected by shop owner')
                                      .then(() => {
                                        toast.success('Product wapas bhej diya gaya.');
                                        mine.reload();
                                      })
                                      .catch((e) => toast.error(e.message));
                                  }}
                                  title="Send back"
                                >
                                  <Icon.X size={16} />
                                </button>
                              </>
                            )}
                            <Link to={`/products/${p.slug}`} className="icon-btn" title="View on site">
                              <Icon.Search size={16} />
                            </Link>
                            <Link to={`/partner/products/${p.id}`} className="icon-btn" title="Edit">
                              <Icon.Edit size={16} />
                            </Link>
                            {confirmId === p.id ? (
                              <span className="confirm-inline">
                                <button className="icon-btn danger" onClick={() => del(p)} title="Confirm delete">
                                  <Icon.Check size={16} />
                                </button>
                                <button className="icon-btn" onClick={() => setConfirmId(null)} title="Cancel">
                                  <Icon.X size={16} />
                                </button>
                              </span>
                            ) : (
                              <button className="icon-btn danger" onClick={() => setConfirmId(p.id)} title="Delete">
                                <Icon.Trash size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'testimonials' && isOwner && (
          <div className="admin-pane">
            <TestimonialsPanel />
          </div>
        )}

        {tab === 'enquiries' && isOwner && (
          <div className="admin-pane">
            {enqList.length === 0 ? (
              <div className="error-state">
                <span className="error-icon empty-icon">
                  <Icon.Inbox size={28} />
                </span>
                <h3 className="h3">No enquiries yet</h3>
                <p className="muted">Contact form se aayi enquiries yahan dikhenge.</p>
              </div>
            ) : (
              <div className="enq-admin-list">
                {enqList.map((e) => (
                  <article key={e.id} className={`enq-card ${e.status}`}>
                    <div className="enq-card-head">
                      <div className="cell-product">
                        <span className="enq-avatar">
                          {String(e.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('')}
                        </span>
                        <div>
                          <strong>{e.name}</strong>
                          <span className="muted">
                            {new Date(e.createdAt).toLocaleString('en-IN', {
                              day: '2-digit', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                      <span className={`badge enq-status-${e.status}`}>{e.status}</span>
                    </div>
                    <p className="enq-subject"><Icon.Tag size={15} /> {e.subject}</p>
                    {e.product && <p className="muted enq-product">Product: {e.product}</p>}
                    <p className="enq-msg">{e.message}</p>
                    <div className="enq-card-foot">
                      <div className="enq-contact">
                        {e.phone && <a href={`tel:${e.phone}`}><Icon.Phone size={14} /> {e.phone}</a>}
                        {e.email && <a href={`mailto:${e.email}`}><Icon.Mail size={14} /> {e.email}</a>}
                      </div>
                      <div className="enq-actions">
                        {e.status !== 'contacted' && (
                          <button className="btn btn-ghost btn-sm" onClick={() => setEnquiryStatus(e.id, 'contacted').then(enqs.reload)}>
                            <Icon.Check size={15} /> Mark contacted
                          </button>
                        )}
                        {e.status !== 'closed' && (
                          <button className="btn btn-ghost btn-sm" onClick={() => setEnquiryStatus(e.id, 'closed').then(enqs.reload)}>
                            Close
                          </button>
                        )}
                        <button className="icon-btn danger" onClick={() => removeEnquiry(e.id).then(enqs.reload)} title="Delete">
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
