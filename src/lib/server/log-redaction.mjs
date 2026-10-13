/**
 * Log-only sanitization. Never use this on an email, response, or stored token.
 * Match raw and percent-encoded query delimiters/keys, including nested dev URLs.
 * Encoded values are removed as a whole rather than decoded into the log.
 */
const keys = ["token", "dev", "dev-link", "devlink"].map(key =>
  [...key].map(char => `(?:${char}|%(?:25)*${char.charCodeAt(0).toString(16)})`).join(""),
).join("|");
const authQuery = new RegExp(
  `((?:&amp;|[?#&]|%(?:25)*3f|%(?:25)*23|%(?:25)*26)(?:${keys})(?:=|%(?:25)*3d))[^&\\s"'<>\`\\\\\\x1b]*`,
  "gi",
);

export function redactAuthUrls(text) {
  return String(text).replace(authQuery, "$1[REDACTED]");
}

export function formatEmailLog(row) {
  const body = row.bodyText || "";
  const preview = /\/auth\/verify\b/i.test(body)
    ? "[sign-in email content redacted; use the development link on the login page]"
    : redactAuthUrls(body).slice(0, 600);
  return redactAuthUrls(`[outbox:email → ${row.toAddr}] ${row.subject}\n${preview}`);
}
