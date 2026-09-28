import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icons';
import ProductImage from '../../components/ProductImage';
import TestimonialsPanel from './PartnerTestimonials';
import PartnerAboutContent from './PartnerAboutContent';
import PartnerVideos from './PartnerVideos';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { useFetch, usePageMeta } from '../../hooks';
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
  syncShopWithApproved,
} from '../../store/db';
import { formatPrice, hasPrice, toPrice } from '../../api';

const TABS = [
  { key: 'products', label: 'My Products', icon: 'Grid' },
  { key: 'approvals', label: 'Approvals', icon: 'Check', ownerOnly: true },
  { key: 'testimonials', label: 'Reviews', icon: 'Sparkle', ownerOnly: true },
  { key: 'about', label: 'About Page', icon: 'Star', ownerOnly: true },
  { key: 'videos', label: 'Videos', icon: 'Play', ownerOnly: true },
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
  usePageMeta({ title: 'Partner Panel', description: 'Manage products, approvals, reviews and enquiries.', noIndex: true });
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

  /**
   * Where the menu is drawn.
   *
   * The menu belongs in the bar at the top of the page, not below the figures,
   * so it is drawn there. The bar is a different component that knows nothing
   * about tabs, approvals or enquiries, so rather than teach it all of that -
   * or lift the menu's state up out of here - it leaves an empty place and this
   * fills it. One shape to keep in step instead of two.
   *
   * It is looked for after the fact because the bar and this screen are siblings:
   * on the first render the place may not be in the document yet, and the bar
   * can be replaced entirely when moving between screens.
   */
  const [barSlot, setBarSlot] = useState(null);
  useEffect(() => {
    const find = () => setBarSlot(document.getElementById('panel-nav-slot'));
    find();
    // The bar is re-rendered on every route change, which can replace the node
    // this points at without the screen itself unmounting.
    find();
  }, [pathname]);

  const mine = useFetch(
    () => (isOwner ? fetchAllProducts() : fetchProductsByOwner(user.email)),
    // Coming back from the add/edit form must re-read, otherwise the table
    // still shows the values from before the save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.email, isOwner, pathname, search]
  );
  const enqs = useFetch(() => (isOwner ? fetchEnquiries() : Promise.resolve([])), [isOwner]);

  /**
   * A read that is merely slow looks exactly like one that has failed: the same
   * "Loading…" with nothing ever after it. And a read that did fail used to fall
   * through to "No products yet", which tells the owner their whole catalogue
   * has vanished when in fact their connection dropped. Say which of the two
   * this is, and give a way out of it.
   */
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    if (!mine.loading) {
      setStalled(false);
      return undefined;
    }
    const t = setTimeout(() => setStalled(true), 8000);
    return () => clearTimeout(t);
  }, [mine.loading]);

  /**
   * The storefront keeps its own copy of every approved product. If those two
   * copies ever drift - a picture saved on one side only - a customer sees a
   * stale image with nothing to indicate it. Only the owner can put a document
   * in the storefront collection, so this runs when the owner opens the panel
   * and quietly lines them up again.
   *
   * Two things it must not do. It must not announce itself: this is routine
   * housekeeping, not something the owner has to read or act on. And it must
   * run only once per visit - the repair re-reads the list, which would change
   * `mine.data` and start the effect all over again, and two overlapping runs
   * would each see the same out-of-date storefront and each report a repair.
   */
  const repairedOnVisit = useRef(false);

  useEffect(() => {
    if (!isOwner || !mine.data?.length || repairedOnVisit.current) return;
    repairedOnVisit.current = true;
    let cancelled = false;

    syncShopWithApproved(mine.data)
      .then(({ repaired, removed }) => {
        if (cancelled || (!repaired && !removed.length)) return;
        console.info(
          `[storefront] ${repaired} product(s) brought up to date` +
            (removed.length ? `, ${removed.length} unpublished` : '')
        );
        mine.reload();
      })
      .catch(() => {
        /* not being able to repair is not worth interrupting the owner for */
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, mine.data]);

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

  // Only the products that actually carry a price add up to anything, so the
  // figure is the value of the priced part of the catalogue. The count of what
  // was left out is kept with it, because "listed value" on its own would quietly
  // understate the shop by every product the owner chose to quote for.
  const priced = list.filter((p) => hasPrice(p));
  const totalValue = priced.reduce((s, p) => s + toPrice(p.price), 0);
  const unpriced = list.length - priced.length;

  // The menu, built here rather than beside the tab state because it needs the
  // counts, which are only known once the products and enquiries have arrived.
  //
  // On a wide screen it is a row of tabs in the bar. On a phone six tabs do not
  // fit, and a row that slides sideways is the worst of both: half a tab is
  // visible, there is nothing to suggest there are more, and the one you want may
  // be off the edge. So below that width it folds away behind one button that
  // says where you are, and opens downwards over the page.
  const [menuOpen, setMenuOpen] = useState(false);
  const openLabel = tabs.find((t) => t.key === tab)?.label || 'Menu';

  const menu = (
    <div className={`admin-menu ${menuOpen ? 'open' : ''}`}>
      <button
        type="button"
        className="admin-menu-toggle"
        onClick={() => setMenuOpen((v) => !v)}
        aria-expanded={menuOpen}
        aria-label={menuOpen ? 'Close the panel menu' : 'Open the panel menu'}
      >
        <Icon.Menu size={18} />
        <span className="admin-menu-current">{openLabel}</span>
        <Icon.ChevronDown size={16} className="admin-menu-caret" />
      </button>

      <div className="admin-tabs" role="tablist" aria-label="Panel sections">
        {tabs.map((t) => {
          const I = Icon[t.icon];
          const waiting =
            t.key === 'approvals'
              ? pending.length
              : t.key === 'enquiries'
                ? enqList.filter((e) => e.status === 'new').length
                : 0;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={`admin-tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => {
                setTab(t.key);
                setMenuOpen(false);
              }}
            >
              <I size={16} /> <span>{t.label}</span>
              {waiting > 0 && <span className="admin-badge">{waiting}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <section className="admin-sec">
      {barSlot ? createPortal(menu, barSlot) : null}
      <div className="container">
        <div className="admin-head">
          <div>
            <span className="eyebrow">Partner Panel</span>
            <h1 className="h2">
              {/* The heading has to follow the tab. It used to be a fixed "All
                  Products", so opening Reviews or the About editor showed a
                  heading naming the one screen you were not looking at. */}
              {tab === 'products'
                ? isOwner
                  ? 'All Products'
                  : 'My Products'
                : tabs.find((t) => t.key === tab)?.label || 'Partner Panel'}
            </h1>
            <p className="muted" style={{ marginTop: 6 }}>
              Signed in as <strong>{user?.email}</strong>
              {isOwner && <span className="badge badge-gold" style={{ marginLeft: 10 }}>OWNER</span>}
            </p>
          </div>
          <div className="admin-head-actions">
            {/* "View Website" lives in the header bar, which is on every panel
                screen including the sign-in one. Having a second copy here put
                two identical buttons in the same view. */}
            <button className="btn btn-ghost btn-sm" onClick={logout}>
              <Icon.LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>

        <div className="grid grid-4 admin-stats">
          {[
            { icon: 'Grid', label: isOwner ? 'All products' : 'My products', value: (mine.data || []).length },
            { icon: 'Tag',
              label: unpriced ? 'Listed value (priced only)' : 'Listed value',
              value: formatPrice(totalValue) },
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
                    Approving puts it live on the website straight away.
                    Rejecting shows the customer your note.
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

            {/* A failed read must not look like an empty shop. */}
        {mine.error && shown.length === 0 ? (
          <div className="error-state">
            <span className="error-icon">
              <Icon.Alert size={28} />
            </span>
            <h3 className="h3">Could not load your products</h3>
            <p className="muted">
              Nothing has been lost — this is a connection problem, not a change
              to your catalogue. Check your internet and try again.
            </p>
            <button
              type="button"
              className="btn btn-brand btn-sm"
              onClick={() => {
                setStalled(false);
                mine.reload();
              }}
            >
              <Icon.Refresh size={15} /> Try again
            </button>
          </div>
        ) : null}

        {mine.loading && shown.length === 0 && (
          <div style={{ padding: 20 }}>
            <p className="muted" style={{ margin: 0 }}>
              {stalled ? 'This is taking longer than usual…' : 'Loading…'}
            </p>
            {stalled && (
              <>
                <p className="muted" style={{ margin: '8px 0 12px' }}>
                  Your connection may be slow. Nothing has been lost, and the
                  page will fill in as soon as it can.
                </p>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setStalled(false);
                    mine.reload();
                  }}
                >
                  <Icon.Refresh size={15} /> Reload
                </button>
              </>
            )}
          </div>
        )}

            {!mine.loading && !mine.error && shown.length === 0 ? (
              <div className="error-state">
                <span className="error-icon empty-icon">
                  <Icon.Grid size={28} />
                </span>
                <h3 className="h3">
                  {tab === 'approvals' ? 'Nothing is waiting for approval' : 'No products yet'}
                </h3>
                <p className="muted">
                  {tab === 'approvals'
                    ? 'Everything has been reviewed. A new product will appear here as soon as it is submitted.'
                    : 'Add your first product — it goes live on the website once it is approved.'}
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
                            <ProductImage
                              src={p.image}
                              alt=""
                              className="cell-img"
                              loading="lazy"
                              preferThumb
                            />
                            <div>
                              <strong>{p.shortName || p.name}</strong>
                              <span className="muted">
                                {/* Whose product it is, but only when it is not the
                                    owner's own - their address is already on screen
                                    and repeating it under all 8 rows is just noise. */}
                                {isOwner && p.ownerEmail && p.ownerEmail !== user?.email
                                  ? `${p.ownerEmail} · `
                                  : ''}
                                /{p.slug}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td><span className="badge">{p.category}</span></td>
                        <td>
                          {hasPrice(p) ? (
                            <>
                              <strong>{formatPrice(p.price)}</strong>
                              {p.packSize && (
                                <span className="muted" style={{ display: 'block' }}>{p.packSize}</span>
                              )}
                            </>
                          ) : (
                            /* The same words the site shows, so the owner can
                               see what a customer sees without opening the
                               product. */
                            <span className="muted">On request</span>
                          )}
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
                                      'Reason for rejection (shown to the customer)',
                                      'Please correct these details and send it again.'
                                    );
                                    if (note === null) return;
                                    rejectProduct(p.id, note || 'Rejected by shop owner')
                                      .then(() => {
                                        toast.success('Product sent for approval again.');
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

        {tab === 'about' && isOwner && (
          <div className="admin-pane">
            <PartnerAboutContent />
          </div>
        )}

        {tab === 'videos' && isOwner && (
          <div className="admin-pane">
            <PartnerVideos />
          </div>
        )}

        {tab === 'enquiries' && isOwner && (
          <div className="admin-pane">
            {enqs.error && enqList.length === 0 ? (
              <div className="error-state">
                <span className="error-icon">
                  <Icon.Alert size={28} />
                </span>
                <h3 className="h3">Could not load the enquiries</h3>
                <p className="muted">
                  Nothing has been lost — this is a connection problem. Check
                  your internet and try again.
                </p>
                <button
                  type="button"
                  className="btn btn-brand btn-sm"
                  onClick={enqs.reload}
                >
                  <Icon.Refresh size={15} /> Try again
                </button>
              </div>
            ) : enqList.length === 0 ? (
              <div className="error-state">
                <span className="error-icon empty-icon">
                  <Icon.Inbox size={28} />
                </span>
                <h3 className="h3">No enquiries yet</h3>
                <p className="muted">Enquiries sent from the contact form will appear here.</p>
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
