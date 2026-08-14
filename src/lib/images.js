// Turning a file the user picked into something the gallery can store.
//
// A photograph off a phone is three or four megabytes, and the API keeps the
// image in the database as a data URL — so it is downscaled here, before it
// is ever sent, rather than shipping the original and hoping. 1200px on the
// long edge is more than the slideshow ever displays.
//
// The server checks the type and the size again on arrival (see
// server/lib/photos.js). This is the courtesy, not the guard.

const MAX_EDGE = 1200;
const QUALITY = 0.82;
export const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp';

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('That file could not be read.'));
  reader.readAsDataURL(file);
});

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('That file is not an image we can read.'));
  img.src = src;
});

// file → a JPEG data URL, downscaled to fit MAX_EDGE. Throws with a message
// worth showing the user.
export async function fileToPhoto(file) {
  if (!file) throw new Error('No file was picked.');
  if (!ACCEPTED_TYPES.split(',').includes(file.type)) {
    throw new Error('Photographs must be JPEG, PNG, or WebP.');
  }

  const original = await readAsDataUrl(file);
  const img = await loadImage(original);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  // Already small enough and already a JPEG: re-encoding would only lose
  // detail for nothing.
  if (scale === 1 && file.type === 'image/jpeg') return original;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', QUALITY);
}
