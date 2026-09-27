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

  const onYouTube = Boolean(ad.youtube);

  const start = () => {
    setPlaying(true);
    // Playback has to survive the poster being swapped out from under it.
    requestAnimationFrame(() => {
      frameRef.current?.querySelector('video, iframe')?.focus?.();
    });
  };

  return (
    <article className={`vcard reveal reveal-d${(index % 3) + 1}`}>
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
            <video
              className="vcard-video"
              src={ad.src}
              poster={ad.poster}
              controls
              autoPlay
              playsInline
              preload="metadata"
            />
          )
        ) : (
          <button
            type="button"
            className="vcard-poster"
            onClick={start}
            aria-label={`Play the video: ${ad.title}`}
          >
            <Picture
              src={ad.poster}
              alt=""
              loading="lazy"
              sizes="(max-width: 900px) 92vw, 30vw"
            />
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
