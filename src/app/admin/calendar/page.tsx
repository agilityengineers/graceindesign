import Link from "next/link";
import { and, asc, desc, eq, gte, lt, ne } from "drizzle-orm";
import { requireArea } from "@/lib/auth/session";
import { db, availabilityBlocks, bookings, leads, paths } from "@/lib/db";
import { getSetting } from "@/lib/server/settings";
import { etDate } from "@/lib/server/consult";
import AdminShell from "@/components/admin/AdminShell";
import { Card, StatusPill, Avatar } from "@/components/admin/ui";
import Toast from "@/components/admin/Toast";
import ConfirmButton from "@/components/admin/Confirm";
import { addAvailabilityBlock, availabilityAction, saveBookingSettings, createBooking } from "@/lib/actions/calendar";
import { setBookingStatus, deleteBooking, cancelBooking } from "@/lib/actions/leads";
import { fmtDate, fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";
const TZ = "America/New_York";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ymdOf = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const addDays = (ymd: string, n: number) => { const [y, m, d] = ymd.split("-").map(Number); const x = new Date(Date.UTC(y, m - 1, d + n, 12)); return x.toISOString().slice(0, 10); };
const weekdayOf = (ymd: string) => { const [y, m, d] = ymd.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay(); };
const hm2min = (hm: string) => { const [h, m] = hm.split(":").map(Number); return h * 60 + m; };
const min2label = (m: number) => { const h = Math.floor(m / 60); const mm = m % 60; return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`; };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ week?: string; ok?: string; err?: string }> }) {
  const user = await requireArea("calendar");
  const sp = await searchParams;
  const today = ymdOf(new Date());
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(sp.week || "") ? sp.week! : today;
  const monday = addDays(anchor, -((weekdayOf(anchor) + 6) % 7));
  const days = Array.from({ length: 5 }, (_, i) => addDays(monday, i));
  const weekStart = etDate(monday, "00:00"); const weekEnd = etDate(addDays(monday, 7), "00:00");
  const [blocks, rows, settings, openLeads, pathRows] = await Promise.all([
    db.select().from(availabilityBlocks).orderBy(asc(availabilityBlocks.id)),
    db.select({ b: bookings, lead: leads }).from(bookings).innerJoin(leads, eq(leads.id, bookings.leadId)).where(and(gte(bookings.startsAt, weekStart), lt(bookings.startsAt, weekEnd))).orderBy(asc(bookings.startsAt)),
    getSetting("booking"),
    db.select({ id: leads.id, name: leads.name, sourceLabel: leads.sourceLabel }).from(leads).where(and(eq(leads.archived, false), ne(leads.stage, "lost"))).orderBy(desc(leads.createdAt)).limit(200),
    db.select({ id: paths.id, label: paths.label }).from(paths),
  ]);
  const active = blocks.filter((b) => b.isActive);
  const blocksFor = (ymd: string) => active.filter((b) => (b.date ? b.date === ymd : b.weekdays.includes(weekdayOf(ymd))));
  const allMins = active.flatMap((b) => [hm2min(b.startTime), hm2min(b.endTime)]);
  const gridStart = Math.min(9 * 60, ...(allMins.length ? allMins : [9 * 60])); const gridEnd = Math.max(17 * 60, ...(allMins.length ? allMins : [17 * 60]));
  const slotMin = 30; const slots: number[] = []; for (let m = Math.floor(gridStart / slotMin) * slotMin; m < gridEnd; m += slotMin) slots.push(m);
  const bookingAt = (ymd: string, m: number) => rows.find(({ b }) => { const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(b.startsAt); const h = Number(p.find((x) => x.type === "hour")?.value); const mi = Number(p.find((x) => x.type === "minute")?.value); return ymdOf(b.startsAt) === ymd && h * 60 + mi >= m && h * 60 + mi < m + slotMin; });
  const label = `${fmtDate(days[0] + "T12:00:00", { month: "short", day: "numeric" })}–${fmtDate(days[4] + "T12:00:00", { day: "numeric" })}`;

  return (
    <AdminShell user={user} active="calendar" title="Calendar" subtitle="Consultation bookings and the availability the public picker shows" actions={<Link href="/contact" className="btn btn-ghost btn-sm" style={{ height: 40, borderRadius: 10 }}>Open public picker →</Link>}>
      <Toast />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.7fr) minmax(0, 1fr)", gap: 20, alignItems: "start" }} className="g2">
        <Card title={`Week of ${label}`} sub={`${settings.durationMin}-minute discovery calls · Eastern time`} action={<div style={{ display: "flex", alignItems: "center", gap: 6 }}><Link href={`/admin/calendar?week=${addDays(monday, -7)}`} className="btn btn-ghost btn-xs" style={{ borderRadius: 8 }} aria-label="Previous week">‹</Link><Link href="/admin/calendar" className="btn btn-ghost btn-xs" style={{ borderRadius: 8 }}>Today</Link><Link href={`/admin/calendar?week=${addDays(monday, 7)}`} className="btn btn-ghost btn-xs" style={{ borderRadius: 8 }} aria-label="Next week">›</Link></div>}>
          <div style={{ overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "70px repeat(5, minmax(110px, 1fr))", gap: 4, minWidth: 620 }}>
              <span />
              {days.map((d) => <div key={d} style={{ textAlign: "center", padding: "6px 0", fontSize: 12, fontWeight: 700, color: d === today ? "#fff" : "#1a2238", background: d === today ? "#1a2238" : "#f7f9fc", borderRadius: 8 }}>{DAYS[weekdayOf(d)]} {Number(d.slice(8))}</div>)}
              {slots.map((m) => (
                <div key={m} style={{ display: "contents" }}>
                  <span style={{ fontSize: 11, color: "#8c95a8", padding: "8px 4px 0 0", textAlign: "right" }}>{m % 60 === 0 ? min2label(m) : ""}</span>
                  {days.map((d) => {
                    const bk = bookingAt(d, m);
                    const avail = blocksFor(d).some((b) => m >= hm2min(b.startTime) && m < hm2min(b.endTime));
                    const past = d < today;
                    return bk ? (
                      <Link key={d} href={`/admin/leads?open=${bk.lead.id}`} title={`${bk.lead.name} · ${fmtDateTime(bk.b.startsAt)}`} style={{ minHeight: 34, padding: "4px 8px", borderRadius: 8, background: bk.b.status === "cancelled" ? "#f2f4f7" : bk.b.status === "no_show" ? "#fbe9e2" : "#1a2238", color: bk.b.status === "booked" || bk.b.status === "done" ? "#fff" : "#6b7486", fontSize: 11, fontWeight: 600, display: "flex", flexDirection: "column", gap: 1, textDecoration: bk.b.status === "cancelled" ? "line-through" : "none" }}><span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bk.lead.name}</span><span style={{ fontWeight: 400, opacity: .8 }}>{new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(bk.b.startsAt)}</span></Link>
                    ) : <div key={d} style={{ minHeight: 34, borderRadius: 8, background: avail ? (past ? "#eef5fb" : "#e6f3fc") : "#f7f9fc", border: avail ? "1px dashed #b9dcf3" : "1px solid transparent" }} />;
                  })}
                </div>))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#6b7486" }}><span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "#e6f3fc", border: "1px dashed #b9dcf3" }} />Available block</span><span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "#1a2238" }} />Booked</span><span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "#f7f9fc", border: "1px solid #e3e6ec" }} />Unavailable</span></div>
          <div style={{ borderTop: "1px solid #eef0f4", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="label-caps">This week's consultations</span>
            {rows.length === 0 && <span style={{ fontSize: 13, color: "#8c95a8" }}>Nothing booked this week.</span>}
            {rows.map(({ b, lead }) => (
              <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, flexWrap: "wrap" }}>
                <Avatar name={lead.name} size={28} />
                <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 160 }}><Link href={`/admin/leads?open=${lead.id}`} style={{ fontWeight: 600, color: "#1a2238" }}>{lead.name}</Link><span style={{ fontSize: 12, color: "#6b7486" }}>{fmtDateTime(b.startsAt)} ET · {pathRows.find((p) => p.id === (lead as { pathId?: string | null }).pathId)?.label || lead.sourceLabel}</span></div>
                <StatusPill status={b.status} />
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {b.status === "booked" && <><form action={setBookingStatus}><input type="hidden" name="bookingId" value={b.id} /><input type="hidden" name="status" value="done" /><button type="submit" className="link-btn">Done</button></form><form action={setBookingStatus}><input type="hidden" name="bookingId" value={b.id} /><input type="hidden" name="status" value="no_show" /><button type="submit" className="link-btn link-muted">No-show</button></form><form action={cancelBooking}><input type="hidden" name="bookingId" value={b.id} /><input type="hidden" name="id" value={lead.id} /><input type="hidden" name="_back" value="/admin/calendar" /><ConfirmButton message="Cancel this consultation?" className="link-btn link-muted">Cancel</ConfirmButton></form></>}
                  {b.status !== "booked" && <form action={setBookingStatus}><input type="hidden" name="bookingId" value={b.id} /><input type="hidden" name="status" value="booked" /><button type="submit" className="link-btn link-muted">Re-open</button></form>}
                  <form action={deleteBooking}><input type="hidden" name="bookingId" value={b.id} /><ConfirmButton message="Delete this booking record?">Delete</ConfirmButton></form>
                </div>
              </div>))}
          </div>
        </Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card title="Book for a lead" sub="Phone bookings land on the same calendar and send the usual confirmation">
            <form action={createBooking} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Lead<select name="leadId" className="admin-input admin-input-sm" required defaultValue="">{openLeads.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.sourceLabel}</option>)}</select></label>
              <label className="label label-caps">Date<input name="date" type="date" className="admin-input admin-input-sm" required defaultValue={today} /></label>
              <label className="label label-caps">Time (ET)<input name="time" type="time" className="admin-input admin-input-sm" required defaultValue="10:00" step={900} /></label>
              <label style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}><input type="checkbox" name="notify" defaultChecked />Email the confirmation + .ics to the lead</label>
              <button type="submit" className="btn btn-navy btn-xs" style={{ gridColumn: "1/-1", justifySelf: "start", borderRadius: 8 }}>Book consultation</button>
            </form>
          </Card>
          <Card title="Availability blocks" sub="Admin-defined; the public picker only shows these">
            {blocks.map((b) => (
              <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, opacity: b.isActive ? 1 : 0.5 }}>
                <div style={{ display: "flex", flexDirection: "column", flex: 1 }}><span style={{ fontWeight: 600 }}>{b.date ? fmtDate(b.date, { weekday: "short", month: "short", day: "numeric" }) : b.weekdays.map((d) => DAYS[d]).join(" · ") || "—"}</span><span style={{ fontSize: 12, color: "#6b7486" }}>{min2label(hm2min(b.startTime))} – {min2label(hm2min(b.endTime))}{b.label ? ` · ${b.label}` : ""}</span></div>
                <form action={availabilityAction}><input type="hidden" name="blockId" value={b.id} /><input type="hidden" name="op" value="toggle" /><button type="submit" className={`toggle${b.isActive ? " is-on" : ""}`} aria-label={b.isActive ? "Disable block" : "Enable block"} /></form>
                <form action={availabilityAction}><input type="hidden" name="blockId" value={b.id} /><input type="hidden" name="op" value="delete" /><ConfirmButton message="Remove this availability block?">Remove</ConfirmButton></form>
              </div>))}
            <form action={addAvailabilityBlock} style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 10, borderTop: "1px solid #eef0f4" }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{DAYS.map((d, i) => <label key={d} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, padding: "4px 8px", borderRadius: 999, border: "1px solid #e3e6ec" }}><input type="checkbox" name="weekdays" value={i} defaultChecked={i >= 1 && i <= 5} />{d}</label>)}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <label className="label label-caps">Start<input name="startTime" type="time" defaultValue="09:00" className="admin-input admin-input-sm" required /></label>
                <label className="label label-caps">End<input name="endTime" type="time" defaultValue="12:00" className="admin-input admin-input-sm" required /></label>
                <label className="label label-caps">One-off date<input name="date" type="date" className="admin-input admin-input-sm" /></label>
              </div>
              <div style={{ display: "flex", gap: 8 }}><input name="label" placeholder="Label (optional)" className="admin-input admin-input-sm" /><button type="submit" className="btn btn-ghost btn-xs" style={{ borderRadius: 8, whiteSpace: "nowrap" }}>+ Add block</button></div>
            </form>
          </Card>
          <Card title="Booking settings">
            <form action={saveBookingSettings} style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
              <label className="label label-caps">Default duration<select name="durationMin" defaultValue={settings.durationMin} className="admin-input admin-input-sm"><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={45}>45 minutes</option><option value={60}>60 minutes</option></select></label>
              <label className="label label-caps">Buffer between calls<select name="bufferMin" defaultValue={settings.bufferMin} className="admin-input admin-input-sm"><option value={0}>None</option><option value={15}>15 minutes</option><option value={30}>30 minutes</option></select></label>
              <label className="label label-caps">Minimum notice<select name="minNoticeHours" defaultValue={settings.minNoticeHours} className="admin-input admin-input-sm"><option value={4}>4 hours</option><option value={24}>24 hours</option><option value={48}>48 hours</option></select></label>
              <label className="label label-caps">Days bookable ahead<input name="horizonDays" type="number" min={3} max={90} defaultValue={settings.horizonDays} className="admin-input admin-input-sm" /></label>
              {([["emailConfirm", "Email confirmation"], ["smsConfirm", "SMS confirmation"], ["sendIcs", "Send .ics invite"], ["attachChecklist", "Attach pre-consult checklist PDF"], ["reminder24h", "Reminder 24h before"]] as const).map(([k, l]) => <label key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>{l}<input type="checkbox" name={k} defaultChecked={settings[k]} /></label>)}
              <button type="submit" className="btn btn-navy btn-xs" style={{ alignSelf: "flex-start", borderRadius: 8 }}>Save settings</button>
            </form>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}
