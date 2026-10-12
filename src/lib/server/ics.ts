/** Server-generated iCalendar (.ics) invites. */
function pad(n: number) { return String(n).padStart(2, "0"); }
export function toIcsDate(d: Date) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}
function esc(s: string) { return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n"); }

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
