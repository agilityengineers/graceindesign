/**
 * The 10-Minute Healthy Home Walk-Through lead magnet: the paths, the words and the small rules the public form,
 * the download page, the PDF route and the email all share. Client-safe: no database, no secrets, no imports.
 *
 * Picture a coat-check ticket. The visitor hands over a first name and an email at the WELLness Resources page and
 * gets two things back at once: the download page (the ticket in hand) and an email carrying the same full link (the
 * ticket in the pocket). Both point at one PDF address, which always serves whatever Grace has published.
 */

/** The thank-you / download page the form lands on and the email links back to. */
export const WALKTHROUGH_PAGE_PATH = "/healthy-home-resources/wellness/checklist";
/** The file name the browser saves the PDF under. */
export const WALKTHROUGH_PDF_FILENAME = "healthy-home-walkthrough.pdf";
/** The PDF itself: a stable address that serves the current checklist (Grace's upload, or the generated one). */
export const WALKTHROUGH_PDF_PATH = `${WALKTHROUGH_PAGE_PATH}/${WALKTHROUGH_PDF_FILENAME}`;
/** How the website labels this source on the Leads board, the dashboard and in Slack. */
export const WALKTHROUGH_SOURCE_LABEL = "Healthy Home checklist";

/** A first name as typed: trimmed, inner whitespace collapsed, control characters removed, at most 100 characters. */
export function cleanFirstName(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}

/**
 * The storage key behind a `/api/media/<key>` link, whether it was saved relative, absolute (any origin: the key is only
 * ever looked up in our own storage), in another letter case or percent-encoded. `null` for anything else.
 */
export function mediaKeyFromUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  let pathname: string;
  try { pathname = new URL(value.trim(), "http://local").pathname; } catch { return null; }
  const m = pathname.match(/^\/api\/media\/(.+)$/i);
  if (!m) return null;
  try { return decodeURIComponent(m[1]); } catch { return m[1]; }
}

export type WalkthroughEmailInput = { firstName: string; title: string; downloadUrl: string; pageUrl: string };

/**
 * The email that follows a checklist request. Plain text: the outbox wraps it in the branded shell and turns the
 * full links into clickable ones. The download link stands on its own line so every mail client shows it whole.
 */
export function walkthroughEmail(input: WalkthroughEmailInput): { subject: string; text: string } {
  const title = (input.title || "").trim() || "The 10-Minute Healthy Home Walk-Through";
  const first = cleanFirstName(input.firstName) || "there";
  const subject = `Your ${title.replace(/^the\s+/i, "")}`;
  const text = [
    `Hi ${first},`,
    `Here's ${title}, the checklist our specialists start with. Download it here:\n${input.downloadUrl}`,
    "Walk one room at a time, note what you find, and bring it to your consultation.",
    `You can come back to it anytime: ${input.pageUrl}`,
    "Grace In Design",
  ].join("\n\n");
  return { subject, text };
}
