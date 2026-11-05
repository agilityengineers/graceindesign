/** Server-generated iCalendar (.ics) invites. */
function pad(n: number) { return String(n).padStart(2, "0"); }
export function toIcsDate(d: Date) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}
function esc(s: string) { return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }

export function buildIcs(opts: { uid: string; start: Date; end: Date; summary: string; description?: string; location?: string; organizerEmail: string; organizerName: string; attendeeEmail?: string; attendeeName?: string; url?: string; method?: "REQUEST" | "CANCEL"; sequence?: number }) {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Grace In Design//Consultations//EN", `METHOD:${opts.method || "REQUEST"}`, "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT", `UID:${opts.uid}`, `DTSTAMP:${toIcsDate(new Date())}`, `DTSTART:${toIcsDate(opts.start)}`, `DTEND:${toIcsDate(opts.end)}`,
    `SEQUENCE:${opts.sequence ?? 0}`, `SUMMARY:${esc(opts.summary)}`,
    opts.description ? `DESCRIPTION:${esc(opts.description)}` : "", opts.location ? `LOCATION:${esc(opts.location)}` : "", opts.url ? `URL:${opts.url}` : "",
    `ORGANIZER;CN=${esc(opts.organizerName)}:mailto:${opts.organizerEmail}`,
    opts.attendeeEmail ? `ATTENDEE;CN=${esc(opts.attendeeName || opts.attendeeEmail)};ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${opts.attendeeEmail}` : "",
    `STATUS:${opts.method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    "BEGIN:VALARM", "TRIGGER:-PT24H", "ACTION:DISPLAY", `DESCRIPTION:${esc(opts.summary)}`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n") + "\r\n";
}

/**
 * A public event as a downloadable calendar entry ("Add to calendar" on /events/<slug>). Events store a date and a free-text
 * time label rather than an exact start time, so this is an all-day entry on the event's own date, with the time label
 * in the description.
 */
export function buildEventIcs(opts: { uid: string; day: string; summary: string; description?: string; location?: string; url?: string }) {
  const ymd = opts.day.replace(/-/g, "");
  const next = new Date(`${opts.day}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Grace In Design//Events//EN", "METHOD:PUBLISH", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT", `UID:${opts.uid}`, `DTSTAMP:${toIcsDate(new Date())}`, `DTSTART;VALUE=DATE:${ymd}`, `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, "")}`,
    `SUMMARY:${esc(opts.summary)}`, opts.description ? `DESCRIPTION:${esc(opts.description)}` : "", opts.location ? `LOCATION:${esc(opts.location)}` : "", opts.url ? `URL:${opts.url}` : "",
    "TRANSP:TRANSPARENT", "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n") + "\r\n";
}
