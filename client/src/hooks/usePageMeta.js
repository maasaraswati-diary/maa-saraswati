import { useEffect } from 'react';

const SITE = 'Maa Saraswati';
const DEFAULT_TITLE = 'MAA SARASWATI | Pure Dairy, Fresh Every Day';
const DEFAULT_DESC =
  'MAA SARASWATI delivers pure, pasteurized milk and high-protein paneer from healthy cows. 100% vegetarian, no artificial additives, delivered fresh to your door every day.';

/** A preview image for links shared on WhatsApp, Facebook and so on. */
const SHARE_IMAGE = '/images/products/milk-city-billboard.jpeg';

/**
 * Only a real, public JPEG or PNG can be used as a share preview.
 *
 * Two kinds of product image are deliberately skipped: the inline SVG
 * illustrations, and the `upload:<id>` references (uploaded photos live in
 * Firestore as text, so they have no address a phone can fetch). WhatsApp and
 * Facebook silently show nothing for either, so we fall back to the billboard
 * rather than point at a file that will not load.
 */
function shareableImage(image) {
  if (!image) return null;
  if (/^upload:/i.test(image)) return null;
  const isRaster = /\.(jpe?g|png)(\?|#|$)/i.test(image);
  if (!isRaster) return null;
  try {
    return new URL(image, window.location.origin).href;
  } catch {
    return null;
  }
}

function upsert(head, selector, attrs) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement(selector.startsWith('link') ? 'link' : 'meta');
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

/**
 * The address a page should claim to be, whatever host it was opened on.
 *
 * Both `maa-saraswati.com` and `www.maa-saraswati.com` serve the same shop, and
 * a canonical link built from the page's own origin therefore points whichever
 * one the visitor happened to type - so the www copy announces itself as the
 * original and the two are indexed as two sites with the same words. Stripping
 * www here is what makes the bare domain the one both copies point at, which is
 * the whole point of a canonical link.
 *
 * A redirect would say the same thing more firmly, and there is one, but it
 * cannot be relied on: the zone rule that carries it does not match requests for
 * a host that is also a Pages custom domain. This works either way, and it also
 * fixes the share preview, which was quoting the www address in WhatsApp.
 */
const canonicalOrigin = () => window.location.origin.replace(/^https?:\/\/www\./i, '');

/**
 * Gives each page its own title, description, canonical link and share preview.
 *
 * A single shared title across every page tells a search engine they are all
 * the same page, and a link posted on WhatsApp with no preview tags shows as a
 * bare URL. Both are fixed from here rather than in each page.
 */
export default function usePageMeta({ title, description, image, type = 'website', noIndex = false }) {
  useEffect(() => {
    const full = title ? `${title} | ${SITE}` : DEFAULT_TITLE;
    const desc = description || DEFAULT_DESC;
    const origin = canonicalOrigin();
    const url = origin + window.location.pathname;
    const img = shareableImage(image) || new URL(SHARE_IMAGE, origin).href;

    document.title = full;

    upsert(document.head, 'meta[name="description"]', { name: 'description', content: desc });

    upsert(document.head, 'meta[property="og:title"]', { property: 'og:title', content: full });
    upsert(document.head, 'meta[property="og:description"]', { property: 'og:description', content: desc });
    upsert(document.head, 'meta[property="og:type"]', { property: 'og:type', content: type });
    upsert(document.head, 'meta[property="og:url"]', { property: 'og:url', content: url });
    upsert(document.head, 'meta[property="og:image"]', { property: 'og:image', content: img });
    upsert(document.head, 'meta[property="og:site_name"]', { property: 'og:site_name', content: SITE });

    upsert(document.head, 'meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    upsert(document.head, 'meta[name="twitter:title"]', { name: 'twitter:title', content: full });
    upsert(document.head, 'meta[name="twitter:description"]', { name: 'twitter:description', content: desc });
    upsert(document.head, 'meta[name="twitter:image"]', { name: 'twitter:image', content: img });

    upsert(document.head, 'link[rel="canonical"]', { rel: 'canonical', href: url });

    upsert(document.head, 'meta[name="robots"]', {
      name: 'robots',
      content: noIndex ? 'noindex, nofollow' : 'index, follow',
    });
  }, [title, description, image, type, noIndex]);
}
