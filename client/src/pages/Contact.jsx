import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../components/Icons';
import EnquiryForm from '../components/EnquiryForm';
import SITE from '../site';
import { usePageMeta } from '../hooks';

const CONTACT_CARDS = [
  {
    icon: 'Phone',
    title: 'Call us',
    lines: [SITE.phone],
    href: SITE.phoneHref,
    note: `${SITE.hours}, all days`,
  },
  {
    icon: 'Mail',
    title: 'Email us',
    lines: [SITE.email],
    href: SITE.emailHref,
    note: 'We reply within one working day',
  },
  {
    icon: 'MapPin',
    title: 'Head Office',
    lines: [SITE.legalName, SITE.locality, `${SITE.city}, ${SITE.state} ${SITE.pincode}`],
    href: null,
    note: 'Tours welcome, no appointment needed',
  },
];

const FAQS = [
  {
    q: 'How quickly will I get a reply?',
    a: 'We call back the same day for any enquiry received before 5:00 PM. Anything after that is picked up first thing the next morning.',
  },
  {
    q: 'Do you deliver in bulk?',
    a: 'Yes. Shops, hotels, offices, hostels and events can order 20 litres or more per day on a standing schedule. There is a separate bulk enquiry form on this page for it.',
  },
  {
    q: 'What is the minimum order for home delivery?',
    a: `Two pouches or packs. Home delivery covers our 40 routes in and around ${SITE.city}; outside those areas, please pick up from the counter or a retail partner.`,
  },
  {
    q: 'My order was late or a pack was damaged. What now?',
    a: 'Send us the delivery details through this form and mark the subject “Delivery or supply issue”. We replace or credit the same day, no receipt arguments.',
  },
  {
    q: 'Can I become a retail partner?',
    a: 'Yes. Choose “Partnership / distribution” in the subject and tell us your shop location and expected daily volume. We will visit you.',
  },
];

export default function Contact() {
  usePageMeta({
    title: 'Contact',
    description:
      'Call +91 98143 91854 or send an enquiry for bulk orders, wholesale supply, delivery routes and retail partnerships in Gurdaspur. We reply the same day.',
  });
  const [params] = useSearchParams();
  const [prefill, setPrefill] = useState({ message: '', product: '' });
  const [openFaq, setOpenFaq] = useState(0);

  // Pre-fill the product when arriving from a product page.
  useEffect(() => {
    const p = params.get('product');
    if (p) {
      setPrefill({
        product: p,
        message: `Hello Maa Saraswati, I would like to know more about ${p} — availability, pricing and bulk options.`,
      });
    }
  }, [params]);

  return (
    <>
      <section className="page-header">
        <div className="page-header-bg" aria-hidden="true" />
        <div className="container">
          <div className="page-header-in">
            <span className="eyebrow reveal">Contact Us</span>
            <h1 className="h2 reveal reveal-d1">
              Let&apos;s talk <span className="serif-it hl">for real</span>
            </h1>
            <p className="lead reveal reveal-d2">
              Bulk orders, product questions, delivery issues or feedback —
              send it below and a real person will call you back the same day.
            </p>
          </div>
        </div>
      </section>

      {/* Contact cards */}
      <section className="section-sm">
        <div className="container">
          <div className="grid grid-3">
            {CONTACT_CARDS.map((c, i) => {
              const I = Icon[c.icon];
              const body = (
                <>
                  <span className="cc-icon">
                    <I size={24} />
                  </span>
                  <h2 className="cc-title">{c.title}</h2>
                  {c.lines.map((l) => (
                    <span key={l} className="cc-line">
                      {l}
                    </span>
                  ))}
                  <span className="cc-note">{c.note}</span>
                </>
              );
              return (
                <div
                  key={c.title}
                  className={`contact-card reveal reveal-d${i + 1}`}
                >
                  {c.href ? (
                    <a href={c.href} className="contact-card-inner">
                      {body}
                    </a>
                  ) : (
                    <div className="contact-card-inner">{body}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Form + info */}
      <section className="section-sm" id="enquiry">
        <div className="container contact-wrap">
          <div className="contact-form-wrap">
            <div className="card form-card reveal">
              <div className="form-card-head">
                <h2 className="h3">Send an enquiry</h2>
                <p className="muted" style={{ fontSize: '0.92rem' }}>
                  Fields marked with <span className="req">*</span> are
                  required.
                </p>
              </div>
              <EnquiryForm
                initialMessage={prefill.message}
                hiddenProduct={prefill.product}
                showWhatsApp
                onDone={() => window.scrollTo({ top: 260, behavior: 'smooth' })}
              />
            </div>
          </div>

          <aside className="contact-aside">
            <div className="map-card reveal">
              <div className="map-art" aria-hidden="true">
                <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice">
                  <rect width="400" height="260" fill="#EAF3EC" />
                  <g stroke="#C8DCCF" strokeWidth="10" fill="none">
                    <path d="M0 90h400M0 180h400M110 0v260M290 0v260" />
                  </g>
                  <g stroke="#F5C64A" strokeWidth="6" fill="none" opacity="0.8">
                    <path d="M0 140h400M200 0v260" />
                  </g>
                  <g fill="#D6E7DC">
                    <rect x="20" y="20" width="70" height="55" rx="6" />
                    <rect x="130" y="105" width="60" height="60" rx="6" />
                    <rect x="305" y="195" width="75" height="50" rx="6" />
                    <rect x="305" y="20" width="70" height="55" rx="6" />
                  </g>
                  <path
                    d="M120 195c40-25 70 10 105-8"
                    stroke="#8FBFA5"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <g transform="translate(232,118)">
                    <circle r="26" fill="#C8102E" opacity="0.18" />
                    <path
                      d="M0-20c-8.8 0-16 7-16 16.5C-16 6 0 20 0 20s16-14 16-23.5C16-13 8.8-20 0-20z"
                      fill="#C8102E"
                    />
                    <circle cy="-4" r="5.5" fill="#fff" />
                  </g>
                  <text
                    x="232"
                    y="160"
                    textAnchor="middle"
                    fontFamily="Outfit, sans-serif"
                    fontSize="13"
                    fontWeight="700"
                    fill="#3D4348"
                  >
                    Maa Saraswati H.O
                  </text>
                </svg>
              </div>
              <div className="map-card-body">
                <h3 className="map-title">
                  <Icon.MapPin size={19} /> Our Head Office &amp; Counter
                </h3>
                <p className="muted" style={{ fontSize: '0.93rem' }}>
                  {SITE.addressOneLine}
                </p>
                <div className="map-actions">
                  <a
                    className="btn btn-ghost btn-sm"
                    href={SITE.mapsHref}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Maps <Icon.ArrowRight size={15} />
                  </a>
                  <a className="btn btn-green btn-sm" href={SITE.phoneHref}>
                    <Icon.Phone size={15} /> Call
                  </a>
                </div>
              </div>
            </div>

            <div className="hours-card reveal reveal-d1">
              <h3 className="map-title">
                <Icon.Clock size={19} /> Store &amp; Dairy Hours
              </h3>
              <ul className="hours-list">
                {[
                  ['Monday – Friday', '6:00 AM – 9:00 PM'],
                  ['Saturday', '6:00 AM – 9:30 PM'],
                  ['Sunday', '7:00 AM – 8:00 PM'],
                  ['Delivery window', '6:00 AM – 11:00 AM'],
                ].map(([d, t]) => (
                  <li key={d}>
                    <span className="muted">{d}</span>
                    <strong>{t}</strong>
                  </li>
                ))}
              </ul>
              <p className="hint" style={{ marginTop: 12 }}>
                Bulk enquiries received after 5:00 PM are answered first thing
                the next morning.
              </p>
            </div>
          </aside>
        </div>
      </section>

      {/* FAQ */}
      <section className="section tint-cream" id="faq">
        <div className="container faq-wrap">
          <div className="faq-intro">
            <span className="eyebrow reveal">Before You Write</span>
            <h2 className="h2 reveal reveal-d1">
              Questions we get every week
            </h2>
            <p className="lead reveal reveal-d2">
              If your question is here, you already have the answer. If it is
              not, the form above is the fastest way to reach us.
            </p>
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
    </>
  );
}
