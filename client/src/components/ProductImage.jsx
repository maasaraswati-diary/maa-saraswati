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

const CACHE_PREFIX = 'ms-img:';
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

  useEffect(() => {
    if (!id || url) return undefined;
    let cancelled = false;

    fetchProductImage(id)
      .then((img) => {
        if (cancelled || !img) return;
        const picked = preferThumb ? img.thumb || img.large : img.large;
        writeCache(id, picked);
        setUrl(picked);
      })
      .catch(() => {
        /* leave the fallback placeholder in place */
      });

    return () => {
      cancelled = true;
    };
  }, [id, preferThumb, url]);

  // While an uploaded picture is on its way, render nothing rather than a
  // broken image icon.
  if (id && !url) {
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
