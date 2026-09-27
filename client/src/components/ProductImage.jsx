import { useEffect, useState } from 'react';
import Picture from './Picture';
import { fetchProductImage, isUploadRef, uploadIdFromRef } from '../store/db';

/**
 * Renders a product picture, whether it is one of the site's own files or one a
 * partner uploaded through the panel.
 *
 * A partner's picture is stored in Firestore as WebP bytes and comes back as a
 * data URL. The first fetch of each picture is kept in localStorage, so the
 * customer pays for it once and every later visit reads it straight off disk.
 */

// Bumped to v4 when the cache key learned to name the size as well as the
// picture. The version is in the key so that a change to how a picture is stored
// retires the old copies instead of leaving visitors on a cached version of it.
const CACHE_PREFIX = 'ms-img:v4:';
const CACHE_LIMIT_MB = 4;

function readCache(key) {
  try {
    return window.localStorage.getItem(CACHE_PREFIX + key) || null;
  } catch {
    return null;
  }
}

function writeCache(key, value) {
  try {
    const full =
      value.length * 2 > CACHE_LIMIT_MB * 1024 * 1024
        ? '' // too big to be worth keeping
        : value;
    if (full) window.localStorage.setItem(CACHE_PREFIX + key, full);
  } catch {
    // Storage full or blocked. Now that both sizes are kept per picture a busy
    // shop can fill the quota, and that is the right thing to happen: the
    // picture still renders, it is just fetched again next visit.
  }
}

/**
 * Retires cache entries written by an earlier version of the picture format.
 *
 * The prefix carries a version, so when the stored pictures changed - padded to
 * a square, say - the old copies would otherwise sit in storage forever,
 * counting against the visitor's quota for no benefit. Cheap to run and only
 * has work to do once per page load.
 */
let purged = false;

function purgeOldCaches() {
  if (purged) return;
  purged = true;
  try {
    const stale = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith('ms-img:') && !key.startsWith(CACHE_PREFIX)) {
        stale.push(key);
      }
    }
    stale.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    /* storage blocked or unavailable - there is nothing to clean up */
  }
}

export default function ProductImage({
  src,
  alt = '',
  className,
  loading = 'lazy',
  sizes,
  preferThumb = false,
  ...rest
}) {
  const id = isUploadRef(src) ? uploadIdFromRef(src) : null;
  // The key has to name the size, not just the picture. One upload holds two
  // files - a small one for grids and the full one for the product page - and
  // they were sharing one key, so whichever was cached last won everywhere. The
  // full-screen viewer opened on a 420px thumbnail, and visiting the grid first
  // meant the product page quietly showed that too.
  const cacheKey = id ? `${id}:${preferThumb ? 'thumb' : 'large'}` : null;
  const [url, setUrl] = useState(() => (cacheKey ? readCache(cacheKey) : null));
  const [failed, setFailed] = useState(false);

  /**
   * A different picture has to start over.
   *
   * The state above is only seeded on the first mount, and the fetch below
   * gives up whenever there is already a url. So when the gallery moved to
   * another picture, the component kept the previous one on screen forever: the
   * thumbnail highlight moved and the large picture did not. Both sizes are the
   * same pixel dimensions, which is why it passed a check that only compared
   * width and height.
   *
   * Adjusted during render rather than in an effect, so the swap happens before
   * anything is painted and there is no frame showing the wrong picture.
   */
  const [shownKey, setShownKey] = useState(cacheKey);
  if (shownKey !== cacheKey) {
    setShownKey(cacheKey);
    setUrl(cacheKey ? readCache(cacheKey) : null);
    setFailed(false);
  }

  useEffect(purgeOldCaches, []);

  useEffect(() => {
    if (!id || url) return undefined;
    let cancelled = false;

    fetchProductImage(id)
      .then((img) => {
        if (cancelled) return;
        if (!img || !img.large) {
          // Surfaced rather than swallowed: a picture that silently never
          // appears is far harder to diagnose than one that complains.
          console.warn('[ProductImage] no image data for', id);
          setFailed(true);
          return;
        }
        const picked = preferThumb ? img.thumb || img.large : img.large;
        writeCache(cacheKey, picked);
        setUrl(picked);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[ProductImage] could not load', id, err?.message || err);
        setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [id, cacheKey, preferThumb, url]);

  // While an uploaded picture is on its way, render a placeholder rather than a
  // broken image icon; if it never arrives, say so rather than spin forever.
  if (id && !url) {
    if (failed) {
      return (
        <span className="img-loading img-missing" title="Image could not be loaded">
          <span>image missing</span>
        </span>
      );
    }
    return <span className={`img-loading ${className || ''}`} aria-hidden="true" />;
  }

  return (
    <Picture
      src={url || src}
      alt={alt}
      className={className}
      loading={loading}
      sizes={sizes}
      {...rest}
    />
  );
}
