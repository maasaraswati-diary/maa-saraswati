/**
 * Shrinks a chosen picture in the browser before it is ever uploaded.
 *
 * A photo straight off a phone is 3-5 MB. Sending that to a partner panel on a
 * free plan would be silly, so the file is redrawn on a canvas and re-encoded as
 * WebP, which lands around 80-120 KB for a shop photograph. Two sizes are
 * produced: a large one for the product page and a small one for the grid, so a
 * listing page never downloads full-size images.
 *
 * Nothing is uploaded here - this only produces data URLs for the caller.
 */

const LARGE_EDGE = 1100;
const THUMB_EDGE = 420;
const QUALITY = 0.72;

/** Firestore rejects documents over about 1 MB; leave plenty of headroom. */
const BUDGET_BYTES = 420 * 1024;

const load = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Ye image parhi nahi ja saki. JPG, PNG ya WebP try karein.'));
    };
    img.src = url;
  });

function draw(img, edge) {
  const scale = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  // JPEG sources have no alpha; filling first avoids black edges.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return { canvas, w, h };
}

const toDataUrl = (canvas, quality) =>
  new Promise((resolve) => {
    // WebP first: every current browser takes it, and it is far smaller.
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(canvas.toDataURL('image/jpeg', quality));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      },
      'image/webp',
      quality
    );
  });

/** Encodes progressively smaller until the data URL fits the budget. */
async function encode(img, edge) {
  let quality = QUALITY;
  let size = edge;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { canvas, w, h } = draw(img, size);
    // eslint-disable-next-line no-await-in-loop
    const dataUrl = await toDataUrl(canvas, quality);
    if (dataUrl.length * 0.75 <= BUDGET_BYTES || attempt === 4) {
      return { dataUrl, w, h, bytes: Math.round(dataUrl.length * 0.75) };
    }
    quality -= 0.12;
    size = Math.round(size * 0.82);
  }
  return null;
}

/**
 * @returns {{large: object, thumb: object, originalBytes: number}} data URLs
 *   ready to be written to Firestore.
 */
export async function optimiseImage(file) {
  if (!file) throw new Error('Koi file select nahi hui.');
  if (!/^image\//.test(file.type)) {
    throw new Error('Sirf image file chalegi (JPG, PNG ya WebP).');
  }

  const img = await load(file);
  const [large, thumb] = await Promise.all([
    encode(img, LARGE_EDGE),
    encode(img, THUMB_EDGE),
  ]);

  return {
    large,
    thumb,
    originalBytes: file.size,
    width: img.naturalWidth,
    height: img.naturalHeight,
  };
}

export const prettyBytes = (bytes) => {
  if (!bytes) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};
