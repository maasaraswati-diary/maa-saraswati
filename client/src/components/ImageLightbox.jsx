import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icons';
import ProductImage from './ProductImage';
import { useScrollLock } from '../hooks';

/**
 * Full-screen picture viewer.
 *
 * The gallery used to offer a bigger picture on hover alone, which is a mouse
 * thing: on a phone nothing ever hovered, so a 1100px photograph was only ever
 * visible inside a 582px box with no way to see any of it properly. This opens
 * on a tap or a click, works the same on both, and steps through the rest of the
 * set with the arrow keys.
 *
 * Follows the same conventions as the enquiry dialog: a labelled dialog, a
 * backdrop that closes it, Escape, and the page behind locked from scrolling.
 */
export default function ImageLightbox({ images, index, onClose, onIndex }) {
  const [active, setActive] = useState(index);
  const closeRef = useRef(null);
  useScrollLock(true);

  /**
   * Keep the parent's thumbnail strip in step, so closing leaves the gallery
   * showing the picture that was last looked at.
   *
   * Told directly from the handler rather than from an effect. An effect runs
   * after the paint, and if the viewer is dismissed first it never runs at all -
   * which left the strip a picture behind the last one actually looked at.
   */
  const goTo = useCallback(
    (next) => {
      const i = (next + images.length) % images.length;
      setActive(i);
      onIndex?.(i);
    },
    [images.length, onIndex]
  );

  const move = useCallback(
    (step) => {
      goTo(active + step);
    },
    [goTo, active]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') move(1);
      else if (e.key === 'ArrowLeft') move(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move, onClose]);

  // Put focus on the close button so a keyboard can get out immediately.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  if (!images.length) return null;

  return (
    <div
      className="pd-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`Picture ${active + 1} of ${images.length}`}
    >
      <div className="pd-lightbox-backdrop" onClick={onClose} />

      <button
        type="button"
        className="pd-lightbox-close"
        onClick={onClose}
        ref={closeRef}
        aria-label="Close the picture"
      >
        <Icon.X size={22} />
      </button>

      {images.length > 1 && (
        <>
          <button
            type="button"
            className="pd-lightbox-nav pd-lightbox-prev"
            onClick={() => move(-1)}
            aria-label="Previous picture"
          >
            <Icon.ArrowLeft size={24} />
          </button>
          <button
            type="button"
            className="pd-lightbox-nav pd-lightbox-next"
            onClick={() => move(1)}
            aria-label="Next picture"
          >
            <Icon.ArrowRight size={24} />
          </button>
        </>
      )}

      <figure className="pd-lightbox-figure">
        <ProductImage
          src={images[active]}
          alt=""
          loading="eager"
          sizes="100vw"
          onClick={(e) => e.stopPropagation()}
        />
        {images.length > 1 && (
          <figcaption className="pd-lightbox-count">
            {active + 1} / {images.length}
          </figcaption>
        )}
      </figure>
    </div>
  );
}
