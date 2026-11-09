/**
 * Consultation-form answers are typed by the visitor and stored as they arrive, so anything
 * in them is untrusted. Two doors keep a planted link away from an admin:
 *
 *  1. `sanitizeAnswers` runs before the lead is saved. In every list answer it keeps the photo
 *     paths our own upload route mints and plain text; anything link- or path-shaped is dropped.
 *     Multiple-choice answers ("Kitchen", "Stairs / entry") are lists too and must survive.
 *  2. `isMediaPath` is what the lead drawer uses to decide whether a value may be an `href`.
 *     It covers leads saved before door 1 existed, or by a caller that skipped it.
 *
 * No imports, so the unit test (`npm run test:consult-answers`) runs without a database or env.
 */

export const LEAD_PHOTO_PREFIX = "/api/media/leads/photos/";
/** Exactly what `src/app/api/consult/upload/route.ts` produces: a nanoid (`[A-Za-z0-9_-]`) and a lower-case extension. */
const LEAD_PHOTO_PATH = /^\/api\/media\/leads\/photos\/[A-Za-z0-9_-]+\.[a-z0-9]+$/;

/** A photo uploaded through the consultation form. Allow-list, so `..`, `?`, `#`, `%`, `\`, whitespace and uppercase are all out. */
export function isLeadPhotoPath(v: unknown): v is string {
  return typeof v === "string" && LEAD_PHOTO_PATH.test(v);
}

export const MEDIA_PREFIX = "/api/media/";

/**
 * A same-origin media path that is safe to put in an `href`. Browsers resolve `..` (and `%2e%2e`)
 * before the request is sent, and treat `\` as `/`, so `/api/media/../../auth/signout` would leave
 * the media route entirely. None of those may appear.
 */
export function isMediaPath(v: unknown): v is string {
  return typeof v === "string" && v.startsWith(MEDIA_PREFIX) && !/\.\.|[%\\\s]/.test(v);
}

/**
 * Link- or path-shaped text: starts with `/` or `\`, has a `scheme://`, or is a `javascript:` /
 * `data:` style URL. Deliberately leaves "Word: text" alone so an admin-authored option label
 * such as "Note: ramps" survives.
 */
export function looksLikeLink(v: string): boolean {
  const s = v.trim();
  return /^[\\/]/.test(s) || /^[a-z][a-z0-9+.-]*:\/\//i.test(s) || /^(javascript|data|vbscript|file|blob):\S/i.test(s);
}

/**
 * Returns a copy of the answers with every list cleaned: an element stays only when it is a
 * string that is either an uploaded photo path or plain text that does not look like a link.
 * Non-list answers pass through unchanged. Built with `Object.fromEntries` so an own `__proto__`
 * key from the JSON body stays an ordinary key instead of becoming the prototype.
 */
export function sanitizeAnswers(answers: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && (isLeadPhotoPath(x) || !looksLikeLink(x))) : v]));
}
