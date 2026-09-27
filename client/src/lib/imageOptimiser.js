/**
 * Shrinks a chosen picture in the browser before it is ever uploaded.
 *
 * A photo straight off a phone is 3-5 MB. Sending that to a partner panel on a
 * free plan would be silly, so the file is redrawn on a canvas and re-encoded as
 * WebP, which lands around 80-120 KB for a shop photograph. Two sizes are
 * produced: a large one for the product page and a small one for the grid, so a
 * listing page never downloads full-size images.
 *
 * The result is always square. Product photos sit in a 1:1 frame on both the
 * card and the product page, and that frame is filled edge to edge, so a photo
 * of any other shape loses its sides. Padding to a square keeps the whole
 * picture instead of cutting it, and leaves the shop owner able to photograph
 * the way they like rather than learning to frame for a website.
 *
 * Nothing is uploaded here - this only produces data URLs for the caller.
 */

const LARGE_EDGE = 1100;
const THUMB_EDGE = 420;
const QUALITY = 0.72;

/**
 * The colour the padding takes. A plain studio white rather than the page
 * cream: the same picture is shown on the card, on the product page and in the
 * owner's own table, and only one of those backgrounds is cream.
 */
const PAD_BACKGROUND = '#ffffff';

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
      reject(new Error('This image could not be read. Please try a JPG, PNG or WebP.'));
    };
    img.src = url;
  });

/**
 * Draws the picture onto a square of `edge` pixels.
 *
 * `pad` decides what happens to a picture that is not square.
 *
 *  true  - the whole picture is kept and the difference is padded. Right for the
 *          product frames, which are square and show the image edge to edge, so
 *          cropping would throw away part of what the shop photographed.
 *
 *  false - the picture is centre-cropped to fill the square instead. Right for
 *          anything shown in a circle. A padded portrait put in a round frame
 *          gains nothing, because the circle cuts the sides off regardless; all
 *          it does is leave a band of padding inside the circle, which makes the
 *          photograph look smaller than the space it has. A face should fill the
 *          space it is given.
 */
function draw(img, edge, pad) {
  const natW = img.naturalWidth;
  const natH = img.naturalHeight;
  const long = Math.max(natW, natH);
  const square = Math.max(1, Math.round(Math.min(edge, long)));

  let sx = 0;
  let sy = 0;
  let sw = natW;
  let sh = natH;

  if (!pad) {
    // Take the largest centred square out of the source.
    const side = Math.min(natW, natH);
    sx = Math.round((natW - side) / 2);
    sy = Math.round((natH - side) / 2);
    sw = side;
    sh = side;
  }

  const scale = square / Math.max(sw, sh);
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement('canvas');
  canvas.width = square;
  canvas.height = square;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  if (pad) {
    // Fill first: a photo with transparency, or an edge antialiasing gap, would
    // otherwise show whatever the canvas defaults to.
    ctx.fillStyle = PAD_BACKGROUND;
    ctx.fillRect(0, 0, square, square);
  }
  ctx.drawImage(
    img,
    sx,
    sy,
    sw,
    sh,
    Math.round((square - w) / 2),
    Math.round((square - h) / 2),
    w,
    h
  );
  return { canvas, w: square, h: square };
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
async function encode(img, edge, pad) {
  let quality = QUALITY;
  let size = edge;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { canvas, w, h } = draw(img, size, pad);
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
 * @param {File} file
 * @param {{pad?: boolean}} [options] `pad: false` centre-crops to a square
 *   instead of padding, for pictures that are shown inside a circle.
 * @returns {{large: object, thumb: object, originalBytes: number}} data URLs
 *   ready to be written to Firestore.
 */
export async function optimiseImage(file, { pad = true } = {}) {
  if (!file) throw new Error('No file was chosen.');
  if (!/^image\//.test(file.type)) {
    throw new Error('Only image files work here (JPG, PNG or WebP).');
  }

  const img = await load(file);
  const [large, thumb] = await Promise.all([
    encode(img, LARGE_EDGE, pad),
    encode(img, THUMB_EDGE, pad),
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
