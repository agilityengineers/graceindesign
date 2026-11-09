/**
 * Image signature ("magic number") checks for photos uploaded through the public
 * consultation form. A pure module with no imports so the upload route, the media
 * route and the unit tests can all use it directly.
 */
/** Where the consultation upload stores photos; src/lib/media-access.ts keeps this folder team-only. */
export const CONSULT_PHOTO_PREFIX = "leads/photos/";

export type AcceptedPhotoMime = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

/** The only types the consultation upload stores, and the extension each is stored with. */
export const ACCEPTED_PHOTO_TYPES: Record<AcceptedPhotoMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const ACCEPTED_PHOTO_LABEL = "JPG, PNG, WebP or GIF";

export type DetectedImage = { mime: AcceptedPhotoMime; ext: string };

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const JPEG = [0xff, 0xd8, 0xff]; // only three bytes: the fourth varies (E0 JFIF, E1 Exif, DB, EE …)
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const GIF87A = ascii("GIF87a");
const GIF89A = ascii("GIF89a");
const RIFF = ascii("RIFF");
const WEBP = ascii("WEBP"); // at offset 8, after RIFF + 4-byte length

function matches(bytes: Uint8Array, at: number, sig: readonly number[]) {
  if (bytes.length < at + sig.length) return false;
  for (let i = 0; i < sig.length; i++) if (bytes[at + i] !== sig[i]) return false;
  return true;
}

/**
 * Decides a file's type from its first bytes alone. The browser-reported MIME type
 * and the filename are deliberately not inputs: both are chosen by the uploader.
 * Returns null for anything that isn't one of the accepted raster formats.
 */
export function detectImageType(bytes: Uint8Array): DetectedImage | null {
  if (matches(bytes, 0, JPEG)) return { mime: "image/jpeg", ext: ACCEPTED_PHOTO_TYPES["image/jpeg"] };
  if (matches(bytes, 0, PNG)) return { mime: "image/png", ext: ACCEPTED_PHOTO_TYPES["image/png"] };
  if (matches(bytes, 0, GIF87A) || matches(bytes, 0, GIF89A)) return { mime: "image/gif", ext: ACCEPTED_PHOTO_TYPES["image/gif"] };
  if (matches(bytes, 0, RIFF) && matches(bytes, 8, WEBP)) return { mime: "image/webp", ext: ACCEPTED_PHOTO_TYPES["image/webp"] };
  return null;
}

export function isAcceptedPhotoMime(mime: string): mime is AcceptedPhotoMime {
  return Object.prototype.hasOwnProperty.call(ACCEPTED_PHOTO_TYPES, mime);
}
