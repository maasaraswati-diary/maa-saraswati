/**
 * An <img> that serves the smallest format the browser understands.
 *
 * The photographs on this site are the single biggest thing a first-time
 * visitor downloads, and the free Firebase plan only serves 360 MB a day, so
 * every kilobyte counts. We keep three versions of each photo (see
 * scripts/optimise-images.mjs): the modern AVIF, the widely supported WebP, and
 * the original JPEG as a last resort.
 *
 *   <Picture src="/images/products/paneer-retail-shelf.jpeg" alt="Paneer" />
 *
 * Anything that is not one of our photographs - an SVG pack illustration, or a
 * picture a partner has uploaded - is passed straight through untouched.
 */
const PHOTO = /\.(jpe?g|png)$/i;

export default function Picture({
  src,
  alt = '',
  className,
  loading,
  width,
  height,
  sizes,
  single = false,
  ...rest
}) {
  // `single` is for a picture that only exists in one format - a frame captured
  // from a film the owner uploaded, say. Offering avif and webp for those would
  // ask the browser for files that were never written, and every miss is a
  // wasted request on the way to the one that does exist.
  if (!src || single || !PHOTO.test(src)) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        loading={loading}
        width={width}
        height={height}
        {...rest}
      />
    );
  }

  const stem = src.replace(PHOTO, '');
  return (
    <picture>
      <source type="image/avif" srcSet={`${stem}.avif`} sizes={sizes} />
      <source type="image/webp" srcSet={`${stem}.webp`} sizes={sizes} />
      <img
        src={src}
        alt={alt}
        className={className}
        loading={loading}
        width={width}
        height={height}
        {...rest}
      />
    </picture>
  );
}
