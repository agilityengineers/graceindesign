/**
 * Who may read a stored object, decided from its key alone. Pure on purpose: no database and nothing
 * from `next/*`, so `tsx --test tests/media-access.test.ts` can exercise every rule.
 *
 * Picture the key's first folder as the label on a filing cabinet. The `leads/` and `projects/`
 * drawers are locked — a team sign-in opens them, and a client's portal token opens the documents
 * attached to their project — while every other drawer holds site content and stays open.
 * The route in src/app/api/media/[...key]/route.ts applies these rules.
 */

export type MediaKind = "public" | "lead" | "lead_photo" | "project" | "invalid";
export type MediaClass = { kind: MediaKind; key: string };

/** Storage key character rule: letters, digits, `.`, `_`, `/`, `-`; anything else becomes a dash. */
export function safeKey(name: string) {
  return name.replace(/[^a-zA-Z0-9._/-]+/g, "-").replace(/-+/g, "-").replace(/^\/+/, "");
}

/**
 * Classify a requested key. The decision is made on the normalised key that storage will actually
 * read, and it fails closed: anything under `leads/` or `projects/` is private whatever its shape.
 */
export function classifyMediaKey(raw: string): MediaClass {
  const key = safeKey(raw);
  const parts = key.split("/");
  if (parts.some((p) => p === "" || p === "." || p === "..")) return { kind: "invalid", key };
  const [root, second] = parts;
  if (root === "leads") return { kind: second === "photos" ? "lead_photo" : "lead", key };
  if (root === "projects") return { kind: "project", key };
  return { kind: "public", key };
}

export function isPrivateMedia(kind: MediaKind) {
  return kind === "lead" || kind === "lead_photo" || kind === "project";
}

/** Portal clients may open lead and project documents attached to their project; consultation photos stay with the team. */
export function portalMayOpen(kind: MediaKind) {
  return kind === "lead" || kind === "project";
}

/** Shown in the browser tab: raster images, PDFs and video. Everything else (SVG included — it can carry script) downloads. */
export function inlineMime(mime: string) {
  return mime === "application/pdf" || mime.startsWith("video/") || (mime.startsWith("image/") && mime !== "image/svg+xml");
}

/** Display name for a file: the last path segment without the `<timestamp>-` prefix the uploaders add, so a saved PDF is "walkthrough.pdf" rather than a bare key. */
export function mediaFileName(key: string) {
  return (key.split("/").pop() || "file").replace(/^\d{13}-/, "") || "file";
}

/**
 * Response headers for a private file. Never cached by a shared cache or kept after the tab closes,
 * never indexed, no referrer leaks the `?portal=` token, and a Content-Security-Policy with no
 * sources so that a stored SVG or HTML-like file could not run script on this origin even if a
 * browser rendered it. (No `sandbox` directive: it would stop the built-in PDF viewer from opening
 * inline PDFs.) `nosniff` is also set site-wide in next.config.ts; repeating it here keeps the route
 * safe on its own.
 */
export function privateFileHeaders(key: string, mime: string): Record<string, string> {
  return {
    "content-type": mime,
    "cache-control": "private, no-store",
    "content-disposition": `${inlineMime(mime) ? "inline" : "attachment"}; filename="${mediaFileName(key)}"`,
    "content-security-policy": "default-src 'none'",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-robots-tag": "noindex",
  };
}

/** Headers for public site content: a stable key, so a year in every cache; shown inline under its own name. */
export function publicFileHeaders(key: string, mime: string): Record<string, string> {
  return { "content-type": mime, "content-disposition": `inline; filename="${mediaFileName(key)}"`, "cache-control": "public, max-age=31536000, immutable" };
}

/** Portal page document links: hand the media route the portal token. Only internal media URLs are touched. */
export function withPortalToken(url: string, token: string) {
  if (!url.startsWith("/api/media/")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}portal=${encodeURIComponent(token)}`;
}

/** Video and audio files the media library can hold and play on pages. */
export function isVideoMime(mime: string | null | undefined) {
  return !!mime && mime.startsWith("video/");
}

/**
 * Reads an HTTP `Range: bytes=…` header against a file of `size` bytes. Browsers ask for video this way, and
 * Safari/iOS won't play a video at all unless the server answers with 206 Partial Content.
 * Returns the inclusive byte span, `null` when there's no usable single range (send the whole file), or
 * "unsatisfiable" when the range starts past the end (send 416).
 */
export function parseByteRange(header: string | null, size: number): { start: number; end: number } | null | "unsatisfiable" {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return null;
  if (m[1] === "") {
    // "bytes=-500": the last 500 bytes.
    const n = Number(m[2]);
    if (n === 0) return "unsatisfiable";
    return { start: Math.max(0, size - n), end: size - 1 };
  }
  const start = Number(m[1]);
  if (start >= size) return "unsatisfiable";
  const end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  if (end < start) return null;
  return { start, end };
}
