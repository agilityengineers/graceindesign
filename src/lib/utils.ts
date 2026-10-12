export function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
export function initials(name: string) {
  return name.split(/\s|&/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}
export function money(n: number | string | null | undefined, opts: { cents?: boolean } = {}) {
  const v = typeof n === "string" ? Number(n) : n ?? 0;
  if (!isFinite(v)) return "$—";
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: opts.cents ? 2 : 0, maximumFractionDigits: opts.cents ? 2 : 0 });
}
export function fmtDate(d: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }, tz = "America/New_York") {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d.length === 10 ? d + "T12:00:00" : d) : d;
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts }).format(date);
}
export function fmtDateTime(d: Date | string | null | undefined, tz = "America/New_York") {
  return fmtDate(d, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }, tz);
}
export function relativeDay(d: Date | string | null | undefined, tz = "America/New_York") {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d.length === 10 ? d + "T12:00:00" : d) : d;
  const fmt = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(x);
  const today = fmt(new Date()), target = fmt(date);
  const tomorrow = fmt(new Date(Date.now() + 86400000)), yesterday = fmt(new Date(Date.now() - 86400000));
  if (target === today) return "Today";
  if (target === tomorrow) return "Tomorrow";
  if (target === yesterday) return "Yesterday";
  return fmtDate(date, { month: "short", day: "numeric" }, tz);
}
export function cx(...parts: (string | false | null | undefined)[]) { return parts.filter(Boolean).join(" "); }
export function pad2(n: number) { return String(n).padStart(2, "0"); }
export function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }
export function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
export function parseNum(v: FormDataEntryValue | null | undefined, def = 0) { const n = Number(String(v ?? "").replace(/[^0-9.-]/g, "")); return isFinite(n) ? n : def; }
export function str(v: FormDataEntryValue | null | undefined) { return typeof v === "string" ? v.trim() : ""; }
export function strOrNull(v: FormDataEntryValue | null | undefined) { const s = str(v); return s ? s : null; }
export function bool(v: FormDataEntryValue | null | undefined) { return v === "on" || v === "true" || v === "1"; }
export function tryJson<T>(s: string, fallback: T): T { try { return JSON.parse(s) as T; } catch { return fallback; } }
