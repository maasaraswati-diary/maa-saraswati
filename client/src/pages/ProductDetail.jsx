import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon, { ICON_MAP } from '../components/Icons';
import Picture from '../components/Picture';
import ProductImage from '../components/ProductImage';
import ProductCard from '../components/ProductCard';
import ImageLightbox from '../components/ImageLightbox';
import { ErrorState, Loader } from '../components/Feedback';
import { useToast } from '../components/Toast';
import { discountPercent, formatPrice, hasPrice, toPrice, PRICE_ON_REQUEST } from '../api';
import { getProduct } from '../catalogue';
import { useFetch, usePageMeta } from '../hooks';

const TABS = [
  { key: 'description', label: 'Description' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'usage', label: 'How to Use' },
  { key: 'faqs', label: 'FAQs' },
];

function Stars({ rating = 0, count, size = 16 }) {
  const full = Math.round(rating);
  return (
    <div className="pd-rating">
      <span className="pd-stars" role="img" aria-label={`Rated ${rating} out of 5`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Icon.Star key={i} size={size} style={{ opacity: i < full ? 1 : 0.22 }} />
        ))}
      </span>
      <strong>{Number(rating).toFixed(1)}</strong>
      {typeof count === 'number' && (
        <span className="muted">({count.toLocaleString('en-IN')} reviews)</span>
      )}
    </div>
  );
}

export default function ProductDetail() {
  const { slug } = useParams();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(
    () => getProduct(slug),
    [slug]
  );

  const [activeImg, setActiveImg] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [tab, setTab] = useState('description');
  const [openFaq, setOpenFaq] = useState(0);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    setActiveImg(0);
    setLightbox(false);
    setTab('description');
    setQty(1);
    setOpenFaq(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [slug]);

  const product = data?.product;
  const related = data?.related || [];

  // The shop may not have posted a price for this one. `priced` is the single
  // answer to that and every price on this page hangs off it, because a missing
  // price compared with JavaScript's loose rules is a zero, and a zero is a price.
  const priced = hasPrice(product);
  const mrp = toPrice(product?.mrp);
  const showMrp = priced && mrp !== null && mrp > product.price;

  // Title, description, share preview and canonical link all follow the product.
  usePageMeta({
    title: product ? `${product.name}` : '',
    description: product
      ? `${product.shortDescription || product.name} - ${
          priced
            ? `${formatPrice(product.price)} for ${product.packSize || product.unit}`
            : 'price on request'
        }. ${(product.highlights || []).slice(0, 3).join('. ')}`
      : '',
    image: product?.image,
    type: 'product',
  });

  const off = product && priced ? discountPercent(product.price, product.mrp) : 0;

  const tabContent = useMemo(() => {
    if (!product) return null;
    switch (tab) {
      case 'nutrition':
        return (
          <div className="tab-pane">
            <h3 className="h3">Nutrition per serving</h3>
            <p className="muted" style={{ marginBottom: 22 }}>
              Indicative values for one {product.packSize || 'serving'} of Maa
              Saraswati {product.shortName || product.name}. Always read the
              printed label for exact figures.
            </p>
            <div className="nutri-grid">
              {(product.nutrition || []).map((n) => (
                <div key={n.label} className="nutri-card">
                  <span className="nutri-value">{n.value}</span>
                  <span className="nutri-label">{n.label}</span>
                  <span className="nutri-per">{n.per}</span>
                </div>
              ))}
            </div>
            <p className="nutri-note">
              <Icon.Info size={16} /> Values are approximate and may vary
              slightly by batch. Percent of daily values is calculated on a
              2,000 kcal reference diet.
            </p>
          </div>
        );
      case 'usage':
        return (
          <div className="tab-pane">
            <h3 className="h3">How to use it</h3>
            <p className="muted" style={{ marginBottom: 22 }}>
              Where {product.shortName || product.name} works best in an
              everyday kitchen.
            </p>
            <div className="usage-grid">
              {(product.usage || []).map((u, i) => (
                <div key={u} className="usage-card">
                  <span className="usage-n">{String(i + 1).padStart(2, '0')}</span>
                  <p>{u}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case 'faqs':
        return (
          <div className="tab-pane">
            <h3 className="h3" style={{ marginBottom: 20 }}>
              Frequently asked questions
            </h3>
            <div className="faq-list">
              {(product.faqs || []).map((f, i) => (
                <div
                  key={f.q}
                  className={`faq-item ${openFaq === i ? 'open' : ''}`}
                >
                  <button
                    className="faq-q"
                    onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                    aria-expanded={openFaq === i}
                  >
                    <span>{f.q}</span>
                    <span className="faq-icon">
                      <Icon.ChevronDown size={20} />
                    </span>
                  </button>
                  <div className="faq-a">
                    <p>{f.a}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return (
          <div className="tab-pane">
            <h3 className="h3" style={{ marginBottom: 16 }}>
              About this product
            </h3>
            {(product.description || []).map((para, i) => (
              <p key={i} className="pd-para">
                {para}
              </p>
            ))}
            {product.shortDescription && (
              <p className="pd-para pd-para-lead">{product.shortDescription}</p>
            )}
          </div>
        );
    }
  }, [tab, product, openFaq]);

  if (loading) {
    return (
      <div className="container" style={{ paddingBlock: 80 }}>
        <Loader label="Loading product details…" minHeight={420} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ paddingBlock: 80 }}>
        <ErrorState message={error} onRetry={reload} />
        <div className="center" style={{ marginTop: 20 }}>
          <Link to="/products" className="btn btn-ghost btn-sm">
            <Icon.ArrowLeft size={16} /> Back to products
          </Link>
        </div>
      </div>
    );
  }

  if (!product) return null;

  const images = product.images?.length ? product.images : [''];

  const lightboxNode = lightbox ? (
    <ImageLightbox
      images={images}
      index={activeImg}
      onIndex={setActiveImg}
      onClose={() => setLightbox(false)}
    />
  ) : null;

  return (
    <>
      {lightboxNode}
      {/* Breadcrumb */}
      <nav className="crumbs container" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <Icon.ChevronRight size={15} />
        <Link to="/products">Products</Link>
        <Icon.ChevronRight size={15} />
        <Link to={`/products?category=${encodeURIComponent(product.category)}`}>
          {product.category}
        </Link>
        <Icon.ChevronRight size={15} />
        <span className="crumb-current">{product.shortName || product.name}</span>
      </nav>

      <section className="pd-top">
        <div className="container pd-grid">
          {/* Gallery */}
          <div className="pd-gallery reveal">
            <div className="pd-main">
              <ProductImage
                src={images[activeImg]}
                alt={product.name}
                loading="eager"
                sizes="(max-width: 900px) 94vw, 58vw"
              />
              <div className="pd-main-badges">
                {off > 0 && <span className="badge badge-red">{off}% OFF</span>}
                {product.featured && (
                  <span className="badge badge-gold">Bestseller</span>
                )}
                {product.fat && (
                  <span className="badge badge-outline" style={{ color: 'var(--ink)' }}>
                    Fat {product.fat}
                  </span>
                )}
              </div>
              {!product.inStock && (
                <div className="pd-oos">Currently out of stock</div>
              )}
              {/* The whole frame is the button now, not a hint sitting on top of
                  it. Hover-zoom stays for a mouse; the tap is what works on a
                  phone, and the label says so. */}
              <button
                type="button"
                className="pd-zoom-hit"
                onClick={() => setLightbox(true)}
                aria-label={`View ${product.name} pictures full screen`}
              />
              <div className="pd-zoom-hint">
                <Icon.Search size={15} />
                <span className="pd-zoom-hint-touch">Tap to enlarge</span>
                <span className="pd-zoom-hint-hover">Hover to zoom</span>
              </div>
            </div>

            {images.length > 1 && (
              <div className="pd-thumbs">
                {images.map((src, i) => (
                  <button
                    key={src + i}
                    className={`pd-thumb ${i === activeImg ? 'active' : ''}`}
                    onClick={() => setActiveImg(i)}
                    aria-label={`View image ${i + 1} of ${images.length}`}
                  >
                    <ProductImage src={src} alt="" loading="lazy" preferThumb />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Buy box */}
          <div className="pd-info reveal reveal-d1">
            <div className="pd-head">
              <span className="pd-cat">{product.category}</span>
              {product.veg && (
                <span className="pd-veg">
                  <span className="veg-mark" /> 100% Vegetarian
                </span>
              )}
            </div>

            <h1 className="pd-title">{product.name}</h1>
            {product.tagline && (
              <p className="pd-tagline">
                <span className="serif-it">{product.tagline}</span>
                {product.taglineEnglish && (
                  <span className="muted"> — {product.taglineEnglish}</span>
                )}
              </p>
            )}

            <div className="pd-meta">
              <Stars rating={product.rating} count={product.reviewCount} />
              {product.soldLabel && (
                <span className="pd-sold">
                  <Icon.Fire size={15} /> {product.soldLabel}
                </span>
              )}
            </div>

            <p className="pd-short">{product.shortDescription}</p>

            {(product.highlights || []).length > 0 && (
              <ul className="pd-highlights">
                {product.highlights.map((h) => {
                  const I =
                    ICON_MAP[h.toLowerCase().split(' ')[0]] || Icon.Check;
                  return (
                    <li key={h}>
                      <span className="pdh-ic">
                        <I size={15} />
                      </span>
                      {h}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="pd-pricebox">
              <div className="pd-price">
                {priced ? (
                  <>
                    <span className="pd-now">{formatPrice(product.price)}</span>
                    {showMrp && (
                      <>
                        <span className="pd-mrp">{formatPrice(mrp)}</span>
                        <span className="pd-save">
                          Save {formatPrice(mrp - product.price)}
                        </span>
                      </>
                    )}
                  </>
                ) : (
                  /* No price posted, so say so and point at the two ways to get
                     one. An empty box here reads as a page that failed to load. */
                  <>
                    <span className="pd-now pd-ask">{PRICE_ON_REQUEST}</span>
                    <span className="pd-save pd-ask-note">
                      Call or message us and we will quote you
                    </span>
                  </>
                )}
              </div>
              <span className="pd-unit">
                per {product.unit} · {product.packSize}
              </span>
            </div>

            {/* Quick facts */}
            <ul className="pd-facts">
              <li>
                <Icon.Snow size={17} />
                <span>
                  <strong>Cold chain</strong>
                  Dispatched chilled
                </span>
              </li>
              <li>
                <Icon.Shield size={17} />
                <span>
                  <strong>FSSAI</strong>
                  Certified facility
                </span>
              </li>
              <li>
                <Icon.Leaf size={17} />
                <span>
                  <strong>Pure</strong>
                  No additives
                </span>
              </li>
            </ul>

            {/* Quantity + actions */}
            <div className="pd-buy">
              <div className="qty">
                <span className="qty-label">Quantity</span>
                <div className="qty-ctrl">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    disabled={qty <= 1}
                    aria-label="Decrease quantity"
                  >
                    <Icon.Minus size={17} />
                  </button>
                  <span className="qty-val">{qty}</span>
                  <button
                    onClick={() => setQty((q) => Math.min(99, q + 1))}
                    aria-label="Increase quantity"
                  >
                    <Icon.Plus size={17} />
                  </button>
                </div>
              </div>

              <Link
                to={`/contact?product=${encodeURIComponent(product.name)}`}
                className="btn btn-red btn-lg pd-cta"
              >
                <Icon.Mail size={19} /> Enquire Now
              </Link>
            </div>

            {/* The running total is arithmetic on a price. With no price there
                is nothing to total, and showing "₹0 for 3 ×" would be a
                promise. */}
            {priced && (
              <div className="pd-total">
                <span className="muted">Total for {qty} ×</span>
                <strong>{formatPrice(product.price * qty)}</strong>
                <span className="muted">
                  {qty} {product.unit}
                  {qty > 1 ? 's' : ''} · {product.packSize} each
                </span>
              </div>
            )}

            <div className="pd-call">
              <Icon.Phone size={18} />
              <span>
                Prefer to talk? Call{' '}
                <a href="tel:+919814391854">+91 98143 91854</a> — 6 AM to 9 PM
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature strip */}
      {(product.features || []).length > 0 && (
        <section className="section-sm pd-features-sec">
          <div className="container">
            <div className="grid grid-4">
              {product.features.map((f, i) => {
                const I = ICON_MAP[f.icon] || Icon.Sparkle;
                return (
                  <div
                    key={f.title}
                    className={`pd-feature reveal reveal-d${i + 1}`}
                  >
                    <span className="pdf-ic">
                      <I size={24} />
                    </span>
                    <h2 className="pdf-title">{f.title}</h2>
                    <p className="pdf-text">{f.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Tabs */}
      <section className="section-sm pd-tabs-sec">
        <div className="container">
          <div className="pd-tabs" role="tablist">
            {TABS.map((t) => {
              const count =
                t.key === 'faqs'
                  ? (product.faqs || []).length
                  : t.key === 'usage'
                    ? (product.usage || []).length
                    : t.key === 'nutrition'
                      ? (product.nutrition || []).length
                      : null;
              return (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={tab === t.key}
                  className={`pd-tab ${tab === t.key ? 'active' : ''}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                  {count != null && <span className="pd-tab-n">{count}</span>}
                </button>
              );
            })}
          </div>

          <div className="pd-tabbody card" key={tab}>
            {tabContent}
          </div>
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="section tint-cream">
          <div className="container">
            <div className="sec-head sec-head-row">
              <div>
                <span className="eyebrow reveal">You may also like</span>
                <h2 className="h2 reveal reveal-d1">
                  More from our dairy
                </h2>
              </div>
              <Link
                to="/products"
                className="btn btn-ghost reveal reveal-d2"
              >
                View all <Icon.ArrowRight size={18} />
              </Link>
            </div>
            <div className="grid grid-products">
              {related.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i + 1} headingLevel={2} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Sticky mobile bar */}
      <div className="pd-sticky">
        <div className="pd-sticky-price">
          {priced ? (
            <>
              <strong>{formatPrice(product.price)}</strong>
              <span>
                {product.packSize} · {qty} {product.unit}
                {qty > 1 ? 's' : ''}
              </span>
            </>
          ) : (
            <>
              <strong className="pd-ask">{PRICE_ON_REQUEST}</strong>
              <span>
                {product.packSize} · {qty} {product.unit}
                {qty > 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            toast.info('Opening WhatsApp enquiry…');
            window.open(
              `https://wa.me/919814391854?text=${encodeURIComponent(
                `Hello Maa Saraswati, I would like to enquire about ${product.name} (${product.packSize}) x${qty}.`
              )}`,
              '_blank'
            );
          }}
        >
          <Icon.Whatsapp size={17} /> WhatsApp
        </button>
        <Link
          to={`/contact?product=${encodeURIComponent(product.name)}`}
          className="btn btn-red btn-sm"
        >
          <Icon.Mail size={16} /> Enquire
        </Link>
      </div>
    </>
  );
}
