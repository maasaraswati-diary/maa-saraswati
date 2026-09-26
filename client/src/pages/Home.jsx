import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import Icon from '../components/Icons';
import ProductCard from '../components/ProductCard';
import { CardSkeleton, ErrorState } from '../components/Feedback';
import { formatPrice } from '../api';
import { getProducts } from '../catalogue';
import { useFetch } from '../hooks';

const STATS = [
  { icon: 'Award', value: '25+', label: 'Years of trust' },
  { icon: 'Family', value: '12,000+', label: 'Happy families' },
  { icon: 'Truck', value: '40+', label: 'Delivery routes' },
  { icon: 'Shield', value: '100%', label: 'FSSAI verified' },
];

const PILLARS = [
  {
    icon: 'Drop',
    title: 'Pure from the farm',
    text: 'Collected from grass-fed, healthy cows. We test every batch before it leaves the dairy.',
    tone: 'green',
  },
  {
    icon: 'Snow',
    title: 'Cold chain, always',
    text: 'Sealed at 4°C and delivered the same morning. The milk in your kitchen is never re-heated.',
    tone: 'blue',
  },
  {
    icon: 'Shield',
    title: 'Safety, tested daily',
    text: 'Pasteurised, lab-checked and FSSAI certified. Records for every batch, every single day.',
    tone: 'red',
  },
  {
    icon: 'Leaf',
    title: 'Nothing artificial',
    text: 'No preservatives, no synthetic colour, no starch. What is on the pack is what is inside.',
    tone: 'gold',
  },
];

const PROCESS = [
  {
    n: '01',
    title: 'Collected at dawn',
    text: 'Milk is taken from the farm while it is still warm and brought straight to the plant within two hours.',
  },
  {
    n: '02',
    title: 'Tested & pasteurised',
    text: 'Every batch is tested, then pasteurised at a controlled temperature to keep it safe and fresh.',
  },
  {
    n: '03',
    title: 'Packed the same day',
    text: 'Pouch or pack is sealed within hours. The packed-on date on your pack is the real story.',
  },
  {
    n: '04',
    title: 'At your door by 7 AM',
    text: 'Our riders run a cold chain from our plant to your kitchen, so it arrives properly chilled.',
  },
];

const TESTIMONIALS = [
  {
    name: 'Sunita Deshpande',
    role: 'Customer since 2011',
    text: 'I have bought their milk every week for fourteen years. It is the only milk my father will drink, and the only one my children finish.',
    rating: 5,
  },
  {
    name: 'Mahir',
    role: 'Runs a Sweet House',
    text: 'We use their paneer for our barfi and peda. The protein is high, the texture holds, and the delivery has never been late once.',
    rating: 5,
  },
  {
    name: 'Dr. Meera Iyer',
    role: 'Paediatrician, Bhopal',
    text: 'I recommend it to my own patients. It is pasteurised, it is consistently standardised, and the labelling is honest.',
    rating: 5,
  },
];

const FAQS = [
  {
    q: 'Is Maa Saraswati milk pasteurised and standardised?',
    a: 'Yes. Every batch is pasteurised for safety and standardised to a consistent 4.5% fat, so the taste and richness never change between pouches.',
  },
  {
    q: 'Do you deliver to my area?',
    a: 'We currently run 40+ delivery routes across Bhopal. Send us an enquiry with your pin code and we will confirm your slot and the minimum order.',
  },
  {
    q: 'What is the minimum order for home delivery?',
    a: 'Two pouches or packs. For shops, hotels and offices we offer bulk rates on 20 litres or more per day.',
  },
  {
    q: 'Can I buy your products in person?',
    a: 'Yes. Our retail counter at Gopal Mandi Road is open daily from 6:00 AM to 9:00 PM, and our products are stocked at 30+ neighbourhood stores.',
  },
  {
    q: 'Are all products vegetarian?',
    a: 'Yes, every Maa Saraswati product is 100% vegetarian and carries the green dot mark on the pack.',
  },
  {
    q: 'How do I place a large order?',
    a: 'Use the enquiry form on the Contact page or call +91 98143 91854. Tell us your requirement and our team will call you back the same day.',
  },
];

function StarRow({ n = 5, size = 15 }) {
  return (
    <div className="star-row" aria-label={`${n} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Icon.Star
          key={i}
          size={size}
          style={{ opacity: i < n ? 1 : 0.25 }}
        />
      ))}
    </div>
  );
}

export default function Home() {
  const { data, loading, error, reload } = useFetch(() => getProducts(), []);
  const [openFaq, setOpenFaq] = useState(0);
  const [activeSlide, setActiveSlide] = useState(0);

  const featured = useMemo(
    () => (data?.products || []).filter((p) => p.featured).slice(0, 6),
    [data]
  );

  // Rotating billboard image in the hero collage.
  const heroImages = [
    '/images/products/milk-poster.jpeg',
    '/images/products/paneer-poster.jpeg',
    '/images/products/milk-city-billboard.jpeg',
  ];

  return (
    <>
      {/* ==================================================== HERO */}
      <section className="hero">
        <div className="hero-bg" aria-hidden="true">
          <div className="hero-blob hero-blob-1" />
          <div className="hero-blob hero-blob-2" />
          <div className="hero-grid-lines" />
        </div>

        <div className="container hero-in">
          <div className="hero-copy">
            <span className="hero-pill reveal">
              <Icon.Sparkle size={15} /> Trusted by 12,000+ families since 1998
            </span>

            <h1 className="display hero-title reveal reveal-d1">
              Pure dairy,
              <br />
              <span className="serif-it hl">no shortcuts.</span>
            </h1>

            <p className="lead reveal reveal-d2">
              Pasteurised milk from healthy cows, high-protein paneer made from
              pure milk, and nothing artificial — delivered fresh to your door
              every single morning.
            </p>

            <div className="hero-cta reveal reveal-d3">
              <Link to="/products" className="btn btn-red btn-lg">
                Explore Products <Icon.ArrowRight size={19} />
              </Link>
              <Link to="/about" className="btn btn-ghost btn-lg">
                <Icon.Family size={19} /> Our Story
              </Link>
            </div>

            <ul className="hero-badges reveal reveal-d4">
              <li>
                <Icon.Check size={16} /> 100% Vegetarian
              </li>
              <li>
                <Icon.Check size={16} /> FSSAI Certified
              </li>
              <li>
                <Icon.Check size={16} /> No Preservatives
              </li>
            </ul>
          </div>

          <div className="hero-visual reveal reveal-d2">
            <div className="hero-stack">
              {heroImages.map((src, i) => (
                <button
                  key={src}
                  className={`hero-card hero-card-${i} ${
                    activeSlide === i ? 'active' : ''
                  }`}
                  onClick={() => setActiveSlide(i)}
                  aria-label={`View image ${i + 1}`}
                >
                  <img src={src} alt="" />
                </button>
              ))}
            </div>

            <div className="hero-float hero-float-rating glass">
              <div className="hfr-stars">
                <Icon.Star size={20} />
                <strong>4.8</strong>
              </div>
              <p className="muted" style={{ fontSize: '0.82rem' }}>
                from 2,400+ reviews
              </p>
            </div>

            <div className="hero-float hero-float-cool glass">
              <span className="hfc-icon">
                <Icon.Snow size={22} />
              </span>
              <div>
                <strong>4°C</strong>
                <p className="muted" style={{ fontSize: '0.8rem' }}>
                  Cold chain
                </p>
              </div>
            </div>

            <div className="hero-float hero-float-dot glass">
              <span className="veg-mark" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                100% Veg
              </span>
            </div>
          </div>
        </div>

        <div className="hero-stats">
          <div className="container hero-stats-in">
            {STATS.map((s, i) => {
              const I = Icon[s.icon];
              return (
                <div
                  key={s.label}
                  className={`hero-stat reveal reveal-d${i + 1}`}
                >
                  <span className="hs-icon">
                    <I size={22} />
                  </span>
                  <div>
                    <strong className="hs-value">{s.value}</strong>
                    <span className="hs-label">{s.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==================================================== MARQUEE */}
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[0, 1].map((rep) => (
            <span key={rep} className="marquee-group">
              {[
                'Pasteurized Standardized Milk',
                'High Protein Paneer',
                'Thick Set Fresh Curd',
                'Cultured Salted Butter',
                'Pure Bilona Desi Ghee',
                'Sliced Cheddar Cheese',
                'Fresh Cooking Cream',
                'Sweet Rose Lassi',
              ].map((t) => (
                <span key={t} className="marquee-item">
                  {t} <span className="marquee-dot">•</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ==================================================== PILLARS */}
      <section className="section tint-green">
        <div className="container">
          <div className="sec-head">
            <span className="eyebrow reveal">Why Maa Saraswati</span>
            <h2 className="h2 reveal reveal-d1">
              Four promises we do not break
            </h2>
            <p className="lead reveal reveal-d2">
              This is the entire business model. There is no second version of
              it.
            </p>
          </div>

          <div className="grid grid-4">
            {PILLARS.map((p, i) => {
              const I = Icon[p.icon];
              return (
                <article
                  key={p.title}
                  className={`pillar tone-${p.tone} reveal reveal-d${i + 1}`}
                >
                  <span className="pillar-icon">
                    <I size={26} />
                  </span>
                  <h3 className="pillar-title">{p.title}</h3>
                  <p className="pillar-text">{p.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==================================================== PRODUCTS */}
      <section className="section" id="products">
        <div className="container">
          <div className="sec-head sec-head-row">
            <div>
              <span className="eyebrow reveal">Our Products</span>
              <h2 className="h2 reveal reveal-d1">
                Straight from our dairy
              </h2>
              <p className="lead reveal reveal-d2">
                Every product below is made in small batches and dispatched the
                same day.
              </p>
            </div>
            <Link
              to="/products"
              className="btn btn-ghost reveal reveal-d2 products-all-btn"
            >
              View all products <Icon.ArrowRight size={18} />
            </Link>
          </div>

          {loading && <CardSkeleton count={6} />}
          {error && <ErrorState message={error} onRetry={reload} />}

          {!loading && !error && (
            <div className="grid grid-products">
              {featured.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i + 1} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ==================================================== PROCESS */}
      <section className="section tint-ink process-sec">
        <div className="container">
          <div className="sec-head">
            <span className="eyebrow reveal" style={{ color: 'var(--gold)' }}>
              Farm to Front Door
            </span>
            <h2 className="h2 reveal reveal-d1">
              What happens before it reaches you
            </h2>
            <p className="lead reveal reveal-d2">
              Four steps, under eight hours, every single day. This is the part
              most brands skip.
            </p>
          </div>

          <div className="process">
            {PROCESS.map((s, i) => (
              <div
                key={s.n}
                className={`process-step reveal reveal-d${i + 1}`}
              >
                <span className="process-n">{s.n}</span>
                <div className="process-body">
                  <h3 className="process-title">{s.title}</h3>
                  <p className="process-text">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================================================== SHOWCASE */}
      <section className="section showcase-sec">
        <div className="container showcase">
          <div className="showcase-media reveal">
            <div className="showcase-frame">
              <img
                src="/images/products/paneer-billboard.jpeg"
                alt="Maa Saraswati paneer campaign billboard"
                loading="lazy"
              />
            </div>
            <div className="showcase-tag glass">
              <span className="badge badge-orange">High Protein</span>
              <strong>18 g protein / 100 g</strong>
              <span className="muted" style={{ fontSize: '0.85rem' }}>
                Rich in milk proteins
              </span>
            </div>
          </div>

          <div className="showcase-copy">
            <span className="eyebrow reveal">Our Paneer</span>
            <h2 className="h2 reveal reveal-d1">
              Soft, high-protein, and made from pure milk
            </h2>
            <p className="lead reveal reveal-d2">
              Slow-set in warm milk and cut the same day. Firm enough to hold
              its shape in a curry, delicate enough to melt into a dessert.
              No starch, no vegetable fat, no preservatives.
            </p>

            <ul className="check-list reveal reveal-d3">
              {[
                'Rich in milk proteins for muscle growth',
                'Natural source of calcium for strong bones',
                'No artificial colours, flavours or preservatives',
                'Sealed pack with a green dot vegetarian mark',
              ].map((t) => (
                <li key={t}>
                  <span className="cl-check">
                    <Icon.Check size={15} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>

            <div className="showcase-actions reveal reveal-d4">
              <Link
                to="/products/high-protein-paneer"
                className="btn btn-red"
              >
                See Paneer Details <Icon.ArrowRight size={18} />
              </Link>
              <div className="showcase-price">
                <span className="sp-now">{formatPrice(190)}</span>
                <span className="sp-size">200 g pack</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================== TESTIMONIALS */}
      <section className="section tint-cream">
        <div className="container">
          <div className="sec-head">
            <span className="eyebrow reveal">Customer Stories</span>
            <h2 className="h2 reveal reveal-d1">
              Twenty-five years of repeat customers
            </h2>
          </div>

          <div className="grid grid-3">
            {TESTIMONIALS.map((t, i) => (
              <figure
                key={t.name}
                className={`quote-card reveal reveal-d${i + 1}`}
              >
                <Icon.Star size={22} className="quote-mark" />
                <StarRow n={t.rating} />
                <blockquote>{t.text}</blockquote>
                <figcaption>
                  <span className="quote-avatar">
                    {t.name
                      .split(' ')
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join('')}
                  </span>
                  <span>
                    <strong>{t.name}</strong>
                    <span className="muted">{t.role}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ==================================================== FAQ */}
      <section className="section" id="faq">
        <div className="container faq-wrap">
          <div className="faq-intro">
            <span className="eyebrow reveal">Questions</span>
            <h2 className="h2 reveal reveal-d1">
              Common things people ask us
            </h2>
            <p className="lead reveal reveal-d2">
              Still unsure about something? Send an enquiry and our team will
              call you back the same day.
            </p>
            <Link
              to="/contact"
              className="btn btn-green reveal reveal-d3"
              style={{ marginTop: 22 }}
            >
              <Icon.Mail size={18} /> Ask Your Question
            </Link>
          </div>

          <div className="faq-list reveal reveal-d2">
            {FAQS.map((f, i) => (
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
      </section>

      {/* ==================================================== CTA */}
      <section className="cta-band">
        <div className="cta-band-bg" aria-hidden="true" />
        <div className="container cta-band-in">
          <div className="cta-copy">
            <h2 className="h2 reveal">
              Bulk orders for shops, hotels and offices
            </h2>
            <p className="lead reveal reveal-d1">
              We supply 30+ neighbourhood stores and 40+ delivery routes. Tell
              us your daily requirement and we will set up a schedule that works
              before your shop opens.
            </p>
            <div className="cta-actions reveal reveal-d2">
              <Link to="/contact" className="btn btn-light btn-lg">
                <Icon.Mail size={19} /> Request a Bulk Quote
              </Link>
              <a
                href="tel:+919814391854"
                className="btn btn-outline-light btn-lg"
              >
                <Icon.Phone size={19} /> +91 98143 91854
              </a>
            </div>
          </div>
          <div className="cta-stats">
            {[
              { v: '12,000+', l: 'Families served' },
              { v: '40+', l: 'Delivery routes' },
              { v: '30+', l: 'Retail partners' },
              { v: '6 AM', l: 'Daily dispatch' },
            ].map((s) => (
              <div key={s.l} className="cta-stat reveal reveal-d3">
                <strong>{s.v}</strong>
                <span>{s.l}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
