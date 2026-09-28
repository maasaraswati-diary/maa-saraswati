import { Link } from 'react-router-dom';
import Icon from './Icons';
import Logo from './Logo';
import SITE from '../site';

const COLUMNS = [
  {
    title: 'Shop',
    links: [
      { to: '/products?category=Milk', label: 'Milk' },
      { to: '/products?category=Paneer%20%26%20Cheese', label: 'Paneer & Cheese' },
      { to: '/products?category=Butter%20%26%20Ghee', label: 'Butter & Ghee' },
      { to: '/products?category=Curd%20%26%20Cream', label: 'Curd & Cream' },
      { to: '/products', label: 'All Products' },
    ],
  },
  {
    title: 'Company',
    links: [
      { to: '/about', label: 'About Us' },
      { to: '/about#story', label: 'Our Story' },
      { to: '/about#promise', label: 'Our Promise' },
      { to: '/contact', label: 'Contact & Enquiry' },
    ],
  },
  {
    title: 'Support',
    links: [
      { to: '/contact', label: 'Bulk Order Enquiry' },
      { to: '/contact#faq', label: 'Common Questions' },
      { to: '/#testimonials', label: 'Customer Reviews' },
      { to: '/videos', label: 'Video Ads' },
      { to: '/products', label: 'Product Catalogue' },
      { to: '/partner', label: 'Partner Login' },
    ],
  },
];

const SOCIALS = [
  { icon: 'Instagram', label: 'Instagram', href: 'https://instagram.com' },
  { icon: 'Facebook', label: 'Facebook', href: 'https://facebook.com' },
  { icon: 'Youtube', label: 'YouTube', href: 'https://youtube.com' },
  { icon: 'Whatsapp', label: 'WhatsApp', href: 'https://wa.me/919814391854' },
];

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-wave" aria-hidden="true">
        <svg viewBox="0 0 1440 90" preserveAspectRatio="none">
          <path
            d="M0 40c180 34 340 34 520 6s360-40 540-22 300 44 380 44v22H0z"
            fill="currentColor"
          />
        </svg>
      </div>

      <div className="container">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="brand">
              <Logo size={52} />
              <span className="brand-text">
                <span className="brand-name brand-name-light">
                  MAA SARASWATI
                </span>
                <span className="brand-sub brand-sub-light">
                  Pure Dairy Co. · Est. 1998
                </span>
              </span>
            </div>
            <p className="footer-blurb">
              A family dairy that has delivered honest, pasteurized milk and
              pure paneer to the same neighbourhood for over 25 years. Nothing
              artificial, nothing hidden, nothing hurried.
            </p>
            <div className="footer-socials">
              {SOCIALS.map((s) => {
                const I = Icon[s.icon];
                return (
                  <a
                    key={s.label}
                    href={s.href}
                    className="social-btn"
                    aria-label={s.label}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <I size={19} />
                  </a>
                );
              })}
            </div>
          </div>

          <div className="footer-cols">
            {COLUMNS.map((col) => (
              <div key={col.title} className="footer-col">
                <h3 className="footer-col-title">{col.title}</h3>
                <ul>
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link to={l.to} className="footer-link">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="footer-contact">
            <h3 className="footer-col-title">Get In Touch</h3>
            <ul className="footer-contact-list">
              <li>
                <span className="fc-icon">
                  <Icon.MapPin size={18} />
                </span>
                <span>
                  {SITE.addressLines[0]}
                  <br />
                  <span className="muted">
                    {SITE.addressLines.slice(1).join(', ')}
                  </span>
                </span>
              </li>
              <li>
                <a href={SITE.phoneHref} className="fc-link">
                  <span className="fc-icon">
                    <Icon.Phone size={18} />
                  </span>
                  {SITE.phone}
                </a>
              </li>
              <li>
                <a href={SITE.emailHref} className="fc-link">
                  <span className="fc-icon">
                    <Icon.Mail size={18} />
                  </span>
                  {SITE.email}
                </a>
              </li>
              <li>
                <span className="fc-icon">
                  <Icon.Clock size={18} />
                </span>
                <span>
                  {SITE.openDays}
                  <br />
                  <span className="muted">{SITE.hours}</span>
                </span>
              </li>
            </ul>
            <Link to="/contact" className="btn btn-light btn-sm footer-btn">
              <Icon.Mail size={16} /> Send an Enquiry
            </Link>
          </div>
        </div>

        <div className="footer-bottom">
          <p>
            © {new Date().getFullYear()} Maa Saraswati Pure Dairy Co. All
            rights reserved.
          </p>
          <p className="footer-legal">
            <span>100% Vegetarian Products</span>
            <span className="dot" />
            <Link to="/partner">Partner Panel</Link>
          </p>
        </div>
      </div>

      <p className="footer-note">
        Nutrition values shown on this site are indicative. Please read the
        printed label on the pack for exact information.
      </p>
    </footer>
  );
}
