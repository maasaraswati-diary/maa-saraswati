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

// Bumped to v3 when pictures became square-padded. The version is in the key so
// that a change to how a picture is stored retires the old copies instead of
// leaving visitors on a cached version of it.
const CACHE_PREFIX = 'ms-img:v3:';
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
    // Storage full or blocked - the picture still renders, just re-fetched.
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
  const [url, setUrl] = useState(() => (id ? readCache(id) : null));
  const [failed, setFailed] = useState(false);

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
        writeCache(id, picked);
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
  }, [id, preferThumb, url]);

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
