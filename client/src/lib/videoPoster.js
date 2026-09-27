/**
 * A poster frame, taken from the film itself.
 *
 * The video page shows a picture before anybody presses play - a poster is the
 * difference between a page that looks finished and one that looks empty. Until
 * now those posters were made on this machine by scripts/prepare-videos.mjs,
 * which only works for films that had been copied across by hand. A film
 * uploaded from the panel has never been seen by that script, so the frame is
 * taken here, in the browser, the moment the file is chosen: the picture then
 * always matches the film above it.
 *
 * If the frame cannot be read - an unusual codec, a browser that will not
 * decode it - this returns null and the card falls back to a plain panel. A
 * missing poster is a small thing; refusing the upload over it would not be.
 */

/** Wide enough for a card, small enough to be a few tens of kilobytes. */
const POSTER_WIDTH = 640;

/** How far into the film to look for a frame worth showing. */
const POSTER_AT = 0.7;

/** Wait for one event, but never forever - a broken file must not hang the panel. */
function waitFor(el, event, timeout) {
  return new Promise((resolve, reject) => {
    const done = (fn, arg) => {
      clearTimeout(timer);
      el.removeEventListener(event, ok);
      el.removeEventListener('error', bad);
      fn(arg);
    };
    const ok = () => done(resolve);
    const bad = () => done(reject, new Error(`The film could not be read (${event}).`));
    const timer = setTimeout(() => done(reject, new Error('Timed out reading the film.')), timeout);
    el.addEventListener(event, ok, { once: true });
    el.addEventListener('error', bad, { once: true });
  });
}

/** The picture in the smallest format the browser will actually produce. */
function canvasToDataUrl(canvas) {
  for (const type of ['image/webp', 'image/jpeg']) {
    let url = '';
    try {
      url = canvas.toDataURL(type, 0.82);
    } catch {
      continue;
    }
    // toDataURL falls back to PNG rather than failing, so the only reliable way
    // to know what it gave back is to look.
    if (url.startsWith(`data:${type}`)) return url;
  }
  return canvas.toDataURL('image/jpeg', 0.82);
}

/**
 * Grab a frame from a video file.
 * @returns {Promise<string|null>} a data: URL, or null if no frame could be read.
 */
export async function makePosterFrame(file) {
  if (typeof document === 'undefined' || !file) return null;

  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';
  video.src = url;

  try {
    await waitFor(video, 'loadeddata', 20000);

    // The very first frame of a film is very often black - a fade up from
    // nothing, or a title still arriving - so take one a little way in instead.
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const at = duration ? Math.min(POSTER_AT, duration * 0.15) : POSTER_AT;
    video.currentTime = at;
    await waitFor(video, 'seeked', 10000);

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;

    // Portrait films stay portrait; nothing is cropped, and the card's frame is
    // 16:9 with the picture centred inside it either way.
    const scale = Math.min(1, POSTER_WIDTH / w);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(2, Math.round(w * scale));
    canvas.height = Math.max(2, Math.round(h * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvasToDataUrl(canvas);
  } catch {
    return null;
  } finally {
    video.removeAttribute('src');
    // Lets the browser release the file straight away rather than when the
    // element happens to be collected.
    video.load();
    URL.revokeObjectURL(url);
  }
}

/** A file size a person can read: "4.2 MB". */
export function fileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
