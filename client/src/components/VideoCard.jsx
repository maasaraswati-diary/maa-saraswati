import { useRef, useState } from 'react';
import Icon from './Icons';
import Picture from './Picture';

/**
 * One video ad.
 *
 * Nothing is downloaded until somebody asks for it. The page shows a poster
 * frame - a small image - and only swaps in a player on click. A visitor who
 * looks through the page costs a few kilobytes rather than several megabytes,
 * which matters because every byte is served on a plan that allows 360 MB a day
 * across everybody.
 *
 * A film can be shown from this site or from a YouTube id, one or the other. The
 * YouTube route costs the site nothing at all, so a film is better hosted there
 * once it has been uploaded.
 */
export default function VideoCard({ ad, index }) {
  const [playing, setPlaying] = useState(false);
  const frameRef = useRef(null);
  const videoRef = useRef(null);

  const onYouTube = Boolean(ad.youtube);

  const start = () => {
    setPlaying(true);
    // Playback has to survive the poster being swapped out from under it.
    requestAnimationFrame(() => {
      frameRef.current?.querySelector('video, iframe')?.focus?.();
    });
  };

  /**
   * Put the film full screen.
   *
   * The standard requestFullscreen is not available on iOS for a video at all -
   * Safari gives a video element its own player, entered a different way. Both
   * are tried so the button works on a phone as well as a computer, and neither
   * one is a problem to leave unsupported: the browser's own fullscreen button in
   * the controls still works.
   */
  const goFullscreen = () => {
    const v = videoRef.current;
    if (!v) return;
    const el = v.webkitEnterFullscreen || v.webkitRequestFullscreen;
    if (typeof el === 'function' && el !== v.requestFullscreen) {
      el.call(v);
      return;
    }
    const req = v.requestFullscreen || v.webkitRequestFullscreen;
    if (typeof req === 'function') {
      const p = req.call(v);
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  };


  return (
    <article id={ad.slug} className={`vcard reveal reveal-d${(index % 3) + 1}`}>
      <div className="vcard-frame" ref={frameRef}>
        {playing ? (
          onYouTube ? (
            <iframe
              className="vcard-embed"
              src={`https://www.youtube-nocookie.com/embed/${ad.youtube}?autoplay=1&rel=0`}
              title={ad.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <>
              <video
                className="vcard-video"
                ref={videoRef}
                src={ad.src}
                poster={ad.poster}
                controls
                autoPlay
                playsInline
                webkit-playsinline="true"
                preload="metadata"
              />
              {/* A full screen button of our own. The browser's is buried in the
                  controls and looks different on every platform; this one is
                  always in the same place. */}
              <button
                type="button"
                className="vcard-expand"
                onClick={goFullscreen}
                aria-label={`Play ${ad.title} full screen`}
                title="Full screen"
              >
                <Icon.Expand size={16} />
              </button>
            </>
          )
        ) : (
          <button
            type="button"
            className={`vcard-poster ${ad.poster ? '' : 'vcard-poster-blank'}`}
            onClick={start}
            aria-label={`Play the video: ${ad.title}`}
          >
            {ad.poster ? (
              <Picture
                src={ad.poster}
                alt=""
                // A poster uploaded from the panel is stored in the one format
                // the browser produced, so the avif and webp sources are not
                // offered - there would be nothing behind them.
                single={ad.poster.startsWith('/media/')}
                loading="lazy"
                sizes="(max-width: 900px) 92vw, 30vw"
              />
            ) : (
              // No poster: the frame keeps its own colour rather than showing a
              // broken picture, and the play button still sits in the middle.
              <span className="vcard-blank-mark" aria-hidden="true">
                MAA SARASWATI
              </span>
            )}
            <span className="vcard-play" aria-hidden="true">
              <Icon.Play size={26} />
            </span>
            <span className="vcard-length">Watch</span>
          </button>
        )}
      </div>

      <div className="vcard-body">
        <h2 className="vcard-title">{ad.title}</h2>
        {ad.note && <p className="vcard-note">{ad.note}</p>}
        <span className="vcard-where">
          {onYouTube ? 'Streams from YouTube' : 'Plays from this site'}
        </span>
      </div>
    </article>
  );
}
