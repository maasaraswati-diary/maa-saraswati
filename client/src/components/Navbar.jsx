import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import Icon from './Icons';
import { useScrollLock } from '../hooks';
import { SITE } from '../site';
import Logo from './Logo';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About Us' },
  { to: '/products', label: 'Products' },
  { to: '/videos', label: 'Videos' },
  { to: '/#testimonials', label: 'Reviews' },
  { to: '/contact', label: 'Contact' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { pathname, hash } = useLocation();
  useScrollLock(open);

  // The partner panel is a private workspace with its own menu inside the
  // dashboard, so the public navigation is left out of it entirely. Leaving the
  // customer's menu sitting above the owner's tools invited people to wander out
  // of the panel by accident, and every one of those links goes somewhere the
  // signed-in owner has no business being. "View Website" is the one deliberate
  // way back to the public site.
  const isPanel = pathname.startsWith('/partner');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      {/* Announcement strip - part of the public site's chrome, so the panel
          does without it. */}
      {!isPanel && (
        <div className="topbar">
          <div className="container topbar-in">
            <a className="topbar-item topbar-link" href={SITE.emailHref}>
              <Icon.Mail size={15} /> {SITE.email}
            </a>
            <span className="topbar-sep" />
            <span className="topbar-item">
              <Icon.Snow size={15} /> Cold chain, farm to doorstep
            </span>
            <span className="topbar-sep" />
            <a className="topbar-item topbar-link" href={SITE.phoneHref}>
              <Icon.Phone size={15} /> {SITE.phone}
            </a>
          </div>
        </div>
      )}

      <header className={`nav ${scrolled ? 'nav-stuck' : ''}`}>
        <div className="container nav-in">
          {/* No aria-label here on purpose: the logo text already reads as the link
          name, and overriding it hides the words a screen reader would say. In the
          panel the logo goes to the dashboard, not off to the public site - the
          button beside it is the way out. */}
      <Link to={isPanel ? '/partner/products' : '/'} className="brand">
            <Logo size={44} />
            <span className="brand-text">
              <span className="brand-name">MAA SARASWATI</span>
              <span className="brand-sub">Pure Dairy Co.</span>
            </span>
          </Link>

          {!isPanel && (
            <nav className="nav-links" aria-label="Main navigation">
              {LINKS.map((l) => {
                // A hash link shares its path with another entry, so it needs the
                // hash checked too - otherwise Reviews and Home would light up
                // together.
                const linkHash = l.to.includes('#') ? l.to.split('#')[1] : '';
                // A hash link shares its path with another entry, so it needs the
                // hash checked too - otherwise Reviews and Home would light up
                // together. While a section is open, plain links step aside.
                const isActive = linkHash
                  ? pathname === '/' && hash.replace('#', '') === linkHash
                  : hash
                    ? false
                    : undefined;
                return (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    end={l.end}
                    className={({ isActive: byPath }) =>
                      `nav-link ${(isActive ?? byPath) ? 'active' : ''}`
                    }
                  >
                    {l.label}
                  </NavLink>
                );
              })}
            </nav>
          )}

          {/*
            The panel's own menu goes here, in the bar, rather than further down
            the page below the figures. It was there, and it was missed: the
            owner's tools looked like a row of numbers with something optional
            underneath, and the Videos tab that most people came for was the
            easiest to walk straight past.

            The dashboard owns the menu - the tabs, which one is open, how many
            approvals and enquiries are waiting - so it draws it here through a
            portal rather than the two halves having to agree on a shape.
          */}
          {isPanel && <div className="nav-panel-slot" id="panel-nav-slot" />}

          <div className="nav-actions">
            {isPanel ? (
              <Link to="/" className="btn btn-green btn-sm nav-cta">
                <Icon.Globe size={17} /> View Website
              </Link>
            ) : (
              <Link to="/products" className="btn btn-red btn-sm nav-cta">
                <Icon.Tag size={17} /> Shop Now
              </Link>
            )}
            {!isPanel && (
              <button
                className="nav-burger"
                onClick={() => setOpen((v) => !v)}
                aria-label={open ? 'Close menu' : 'Open menu'}
                aria-expanded={open}
              >
                <Icon.Menu size={24} />
              </button>
            )}
          </div>
        </div>
        <div className="nav-progress" aria-hidden="true" />
      </header>

      {/* Mobile drawer. Only the public site has one: every link in here leads
          away from the panel, and the panel has its own tabs. */}
      {!isPanel && (
      <div
        className={`drawer ${open ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        <div className="drawer-backdrop" onClick={() => setOpen(false)} />
        <div className="drawer-panel">
          <div className="drawer-head">
            <div className="brand">
              <Logo size={38} />
              <span className="brand-text">
                <span className="brand-name">MAA SARASWATI</span>
              </span>
            </div>
            <button
              className="drawer-close"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <Icon.X size={22} />
            </button>
          </div>

          <nav className="drawer-links">
            {LINKS.map((l, i) => {
              const linkHash = l.to.includes('#') ? l.to.split('#')[1] : '';
              const isActive = linkHash
                ? pathname === '/' && hash.replace('#', '') === linkHash
                : hash
                  ? false
                  : undefined;
              return (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  style={{ '--i': i }}
                  className={({ isActive: byPath }) =>
                    `drawer-link ${(isActive ?? byPath) ? 'active' : ''}`
                  }
                >
                  {l.label}
                  <Icon.ChevronRight size={18} />
                </NavLink>
              );
            })}
            <NavLink
              to="/partner"
              style={{ '--i': LINKS.length }}
              className="drawer-link drawer-admin"
            >
              Partner Panel
              <Icon.Lock size={17} />
            </NavLink>
          </nav>

          <div className="drawer-foot">
            <a href="tel:+919781444655" className="btn btn-green btn-block">
              <Icon.Phone size={18} /> Call for Bulk Orders
            </a>
            <p className="muted" style={{ fontSize: '0.85rem', marginTop: 14 }}>
              Open daily, 6:00 AM – 9:00 PM
            </p>
          </div>
        </div>
      </div>
      )}
    </>
  );
}
