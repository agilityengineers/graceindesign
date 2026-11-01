"use server";
/** Admin → Newsletter: website sign-ups and the hand-off to Insta-Newsletter (src/lib/server/insta-newsletter.ts). */
import { adminAction, backTo } from "./_util";
import { str, strOrNull, parseNum, bool } from "@/lib/utils";
import { getSetting, setSetting } from "@/lib/server/settings";
import { AUDIENCES, CARIBBEAN_SEGMENTS, isAudienceKey } from "@/lib/newsletter";
import { pushSubscriber, pushUnsubscribe, connectInsta, disconnectInsta, syncPendingSubscribers, setSubscriberUnsubscribed, deleteSubscriber, addManualSubscriber, instaConnection, type PushResult } from "@/lib/server/insta-newsletter";

const BACK = "/admin/newsletter";
const REVAL = ["/admin/newsletter", "/admin/caribbean", "/admin/content/settings"];

/** What happened in Insta-Newsletter, for the toast. */
function describePush(r: PushResult): string {
  if ("skipped" in r) return r.skipped;
  switch (r.status) {
    case "synced": return "Added to Insta-Newsletter";
    case "confirming": return "Insta-Newsletter emailed them a confirmation link";
    case "suppressed": return "They unsubscribed in Insta-Newsletter earlier, so they were not re-added";
    case "removed": return "Removed from Insta-Newsletter";
    case "queued": return `Insta-Newsletter could not take it right now; the website will retry (${r.error})`;
    default: return `Insta-Newsletter refused it: ${r.error}`;
  }
}

export async function subscriberAction(formData: FormData) {
  const op = str(formData.get("op")); const audience = str(formData.get("audience")); const id = parseNum(formData.get("subscriberId"));
  await adminAction("newsletter", "subscriber", op, async () => {
    if (!isAudienceKey(audience)) throw new Error("Unknown list");
    if (op === "delete") { await deleteSubscriber(audience, id); return "Removed from the website's records"; }
    if (op === "unsubscribe") { await setSubscriberUnsubscribed(audience, id, new Date()); return `Unsubscribed on the website · ${describePush(await pushUnsubscribe(audience, id))}`; }
    if (op === "resubscribe") { await setSubscriberUnsubscribed(audience, id, null); return `Re-subscribed on the website · ${describePush(await pushSubscriber(audience, id))}`; }
    if (op === "sync") return describePush(await pushSubscriber(audience, id));
    throw new Error("Unknown action");
  }, { back: backTo(formData, BACK), ok: (msg) => msg, entityId: () => `${audience}:${id}`, revalidate: REVAL });
}

export async function addSubscriber(formData: FormData) {
  const email = str(formData.get("email")).toLowerCase(); const audience = str(formData.get("audience"));
  await adminAction("newsletter", "subscriber", "add", async (user) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address");
    if (!isAudienceKey(audience)) throw new Error("Pick a list");
    const segment = str(formData.get("segment")); const location = strOrNull(formData.get("location"));
    const id = await addManualSubscriber({ audience, email, segment: (CARIBBEAN_SEGMENTS as readonly string[]).includes(segment) ? segment : null, location, by: user.email });
    return `${email} added to ${AUDIENCES[audience].name} · ${describePush(await pushSubscriber(audience, id))}`;
  }, { back: `${BACK}?tab=subscribers`, ok: (msg) => msg, entityId: () => email, revalidate: REVAL });
}

export async function saveNewsletterSettings(formData: FormData) {
  await adminAction("newsletter", "setting", "update", async () => {
    const s = await getSetting("newsletter");
    await setSetting("newsletter", { ...s, doubleOptIn: bool(formData.get("doubleOptIn")), sendWelcomeEmail: bool(formData.get("sendWelcomeEmail")) });
    return "newsletter";
  }, { back: `${BACK}?tab=settings`, ok: "Newsletter settings saved", entityId: (k) => k, revalidate: REVAL });
}

export async function connectInstaNewsletter(formData: FormData) {
  await adminAction("newsletter", "integration", "connect", async () => {
    const { settings, problems } = await connectInsta({ url: str(formData.get("url")), apiKey: str(formData.get("apiKey")) });
    return problems.length ? `Connected to ${settings.instaAccountName || "Insta-Newsletter"}, but: ${problems[0]}` : `Connected to ${settings.instaAccountName || "Insta-Newsletter"}. New sign-ups now flow straight in.`;
  }, { back: `${BACK}?tab=insta`, ok: (msg) => msg, entityId: () => "insta_newsletter", revalidate: REVAL });
}

export async function instaAction(formData: FormData) {
  const op = str(formData.get("op"));
  await adminAction("newsletter", "integration", op, async () => {
    if (op === "check") { const { settings, problems } = await connectInsta({}); return problems.length ? `Connection works, but: ${problems[0]}` : `Connection works: ${settings.instaAccountName || "Insta-Newsletter"}, ${settings.instaPlan ? `${settings.instaPlan.used} of ${settings.instaPlan.cap} contacts used` : "plan unknown"}`; }
    if (op === "disconnect") { const { conn } = await instaConnection(); if (conn?.source === "secrets") throw new Error("The key is set in Replit Secrets (INSTA_NEWSLETTER_API_KEY); remove it there to disconnect."); await disconnectInsta(); return "Disconnected. Sign-ups are kept on the website until you connect again."; }
    if (op === "sync_all") {
      const r = await syncPendingSubscribers(100);
      if (r.skipped) throw new Error(r.skipped);
      const parts = [r.subscribed && `${r.subscribed} added`, r.unsubscribed && `${r.unsubscribed} removed`, r.confirming && `${r.confirming} awaiting confirmation`, r.suppressed && `${r.suppressed} already unsubscribed there`, r.queued && `${r.queued} to retry`, r.failed && `${r.failed} failed`, r.remaining && `${r.remaining} still waiting (run again)`].filter(Boolean);
      return parts.length ? `Sync done: ${parts.join(", ")}` : "Everything is already in Insta-Newsletter";
    }
    throw new Error("Unknown action");
  }, { back: `${BACK}?tab=insta`, ok: (msg) => msg, entityId: () => "insta_newsletter", revalidate: REVAL });
}
