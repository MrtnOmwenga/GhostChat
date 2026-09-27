/*
 * Getting files ready to encrypt. Images are re-encoded in the browser: smaller uploads, and no
 * EXIF metadata, so a photo can't reveal where or with what phone it was taken. Each image also
 * gets a small thumbnail that travels inside the encrypted message, so a preview shows at once.
 */

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_SIDE = 2048;
const THUMB_BYTES = 12 * 1024;

// Only raster images are shown inline. Anything else (SVG and HTML included) is offered as a
// download, never rendered, because a decrypted file is shown from this site's own origin.
const INLINE = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export const isInlineImage = (mime) => INLINE.includes(mime);

export const formatBytes = (n) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const toBlob = (canvas, type, quality) => new Promise((resolve) => { canvas.toBlob(resolve, type, quality); });

async function draw(bitmap, maxSide, quality) {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  // Browsers that can't encode WebP fall back to PNG, which is large for photos: use JPEG then.
  let blob = await toBlob(canvas, 'image/webp', quality);
  if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', quality);
  return { blob, width: canvas.width, height: canvas.height };
}

const bytesOf = async (blob) => new Uint8Array(await blob.arrayBuffer());

function base64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

const renamed = (name, mime) => {
  const ext = { 'image/webp': 'webp', 'image/jpeg': 'jpg' }[mime];
  return ext ? `${name.replace(/\.[^.]*$/, '') || 'image'}.${ext}` : name;
};

async function thumbnail(bitmap) {
  for (const [side, quality] of [[320, 0.6], [200, 0.5], [120, 0.4]]) {
    // eslint-disable-next-line no-await-in-loop
    const { blob } = await draw(bitmap, side, quality);
    // eslint-disable-next-line no-await-in-loop
    if (blob && blob.size <= THUMB_BYTES) return { mime: blob.type, data: base64(await bytesOf(blob)) };
  }
  return null;
}

/**
 * Returns { bytes, name, mime, width?, height?, thumb? }. Animated GIFs are kept as they are;
 * other images are scaled to at most 2048 px and re-encoded.
 */
export async function prepareFile(file) {
  const name = (file.name || 'file').slice(0, 200);
  const mime = file.type || 'application/octet-stream';
  const original = { bytes: await bytesOf(file), name, mime: isInlineImage(mime) ? mime : 'application/octet-stream' };
  if (!isInlineImage(mime)) return { ...original, mime: mime.slice(0, 100) };
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { ...original, mime: 'application/octet-stream' }; // not a decodable image after all
  }
  try {
    const thumb = await thumbnail(bitmap);
    if (mime === 'image/gif') {
      return {
        ...original, width: bitmap.width, height: bitmap.height, ...(thumb ? { thumb } : {}),
      };
    }
    const { blob, width, height } = await draw(bitmap, MAX_SIDE, 0.85);
    return {
      bytes: await bytesOf(blob), name: renamed(name, blob.type), mime: blob.type, width, height, ...(thumb ? { thumb } : {}),
    };
  } finally {
    bitmap.close();
  }
}

/** A data: URL for an embedded thumbnail, or null if it isn't a plain raster image. */
export function thumbUrl(file) {
  const { thumb } = file;
  if (!thumb || !['image/webp', 'image/jpeg', 'image/png'].includes(thumb.mime) || !/^[A-Za-z0-9+/]+=*$/.test(thumb.data)) return null;
  return `data:${thumb.mime};base64,${thumb.data}`;
}
