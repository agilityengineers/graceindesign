"use server";
import { eq, ne, and } from "drizzle-orm";
import { db, users, integrations, sessions, USER_ROLES, type UserRole } from "@/lib/db";
import { requireOwner } from "@/lib/auth/session";
import { adminAction } from "./_util";
import { str, strOrNull, parseNum, bool, tryJson } from "@/lib/utils";
import { getSetting, setSetting, type SocialLink } from "@/lib/server/settings";
import { issueMagicLink } from "@/lib/auth/magic-link";
import { env } from "@/lib/env";
import { slackConfigured } from "@/lib/server/slack";
import { cftSmsConfigured } from "@/lib/server/cft-master";
import { revokeCftLaunchLinks } from "@/lib/server/cft-links";
import { instaLiveStatus } from "@/lib/server/insta-newsletter";

const BACK = "/admin/content/settings";
const REVAL = [BACK, "/", "/contact", "/about"];

export async function saveAmazonSettings(formData: FormData) {
  await adminAction("pages", "setting", "update", async () => {
    const a = await getSetting("amazon");
    await setSetting("amazon", { ...a, associateTag: str(formData.get("associateTag")).replace(/\s+/g, ""), cartButtons: bool(formData.get("cartButtons")) });
    return "amazon";
  }, { back: BACK, ok: "Amazon shop settings saved", entityId: (k) => k, revalidate: [...REVAL, "/healthy-home-resources/aip-products", "/healthy-home-resources"] });
}
export async function saveContactSettings(formData: FormData) {
  await adminAction("pages", "setting", "update", async () => {
    const c = await getSetting("contact"); const f = await getSetting("footer"); const seo = await getSetting("seo");
    await setSetting("contact", { ...c, phone: str(formData.get("phone")) || c.phone, email: str(formData.get("email")) || c.email, hours: str(formData.get("hours")) || c.hours, address: str(formData.get("address")), addressLine2: str(formData.get("addressLine2")), utilityLabel: str(formData.get("utilityLabel")) || c.utilityLabel, consultationsNote: str(formData.get("consultationsNote")) || c.consultationsNote });
    await setSetting("footer", { ...f, blurb: str(formData.get("blurb")) || f.blurb, copyright: str(formData.get("copyright")) || f.copyright });
    await setSetting("seo", { ...seo, siteName: str(formData.get("siteName")) || seo.siteName, defaultDescription: str(formData.get("defaultDescription")) || seo.defaultDescription });
    return "contact";
  }, { back: BACK, ok: "Contact & footer saved", entityId: (k) => k, revalidate: REVAL });
}
export async function saveSocialLinks(formData: FormData) {
  await adminAction("pages", "setting", "update", async () => {
    const names = formData.getAll("name").map(String); const urls = formData.getAll("url").map(String); const enabled = formData.getAll("enabled").map(String);
    const links: SocialLink[] = names.map((n, i) => ({ name: n.trim(), url: urls[i]?.trim() || "", enabled: enabled.includes(String(i)) })).filter((l) => l.name);
    const addName = str(formData.get("newName")); const addUrl = str(formData.get("newUrl")); if (addName) links.push({ name: addName, url: addUrl, enabled: true });
    await setSetting("social_links", links); return "social_links";
  }, { back: BACK, ok: "Social links saved", entityId: (k) => k, revalidate: REVAL });
}
export async function removeSocialLink(formData: FormData) {
  const idx = parseNum(formData.get("index"), -1);
  await adminAction("pages", "setting", "update", async () => { const links = await getSetting("social_links"); if (idx >= 0) links.splice(idx, 1); await setSetting("social_links", links); return "social_links"; }, { back: BACK, ok: "Network removed", entityId: (k) => k, revalidate: REVAL });
}

// --- Users & roles (owners only) --------------------------------------------
export async function inviteUser(formData: FormData) {
  await adminAction("users", "user", "invite", async (actor) => {
    await requireOwner();
    const email = str(formData.get("email")).toLowerCase(); const name = str(formData.get("name")) || email.split("@")[0];
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email");
    const role = (USER_ROLES as readonly string[]).includes(str(formData.get("role"))) ? (str(formData.get("role")) as UserRole) : "editor";
    if (await db.query.users.findFirst({ where: eq(users.email, email) })) throw new Error("That email already has an account");
    const [u] = await db.insert(users).values({ email, name, role, title: strOrNull(formData.get("title")), invitedAt: new Date(), isActive: true }).returning();
    await issueMagicLink(email, "/admin");
    void actor;
    return u.id;
  }, { back: BACK, ok: "Invited — a sign-in link was emailed", entityId: (id) => id, revalidate: [BACK] });
}
export async function updateUser(formData: FormData) {
  const id = parseNum(formData.get("userId")); const op = str(formData.get("op"));
  await adminAction("users", "user", op, async (actor) => {
    await requireOwner();
    const target = await db.query.users.findFirst({ where: eq(users.id, id) }); if (!target) throw new Error("User not found");
    const self = target.id === actor.id;
    if (op === "update") {
      const role = (USER_ROLES as readonly string[]).includes(str(formData.get("role"))) ? (str(formData.get("role")) as UserRole) : target.role;
      if (self && role !== "owner") throw new Error("You can't remove your own owner role");
      if (target.isSuperAdmin && !actor.isSuperAdmin && role !== "owner") throw new Error("Only a super admin can change another super admin");
      await db.update(users).set({ name: str(formData.get("name")) || target.name, role, title: strOrNull(formData.get("title")), isSuperAdmin: actor.isSuperAdmin && formData.has("superForm") ? bool(formData.get("isSuperAdmin")) || self : target.isSuperAdmin, updatedAt: new Date() }).where(eq(users.id, id));
    } else if (op === "deactivate" || op === "activate") {
      if (self) throw new Error("You can't deactivate yourself");
      if (target.isSuperAdmin && !actor.isSuperAdmin) throw new Error("Only a super admin can deactivate a super admin");
      await db.update(users).set({ isActive: op === "activate", updatedAt: new Date() }).where(eq(users.id, id));
      if (op === "deactivate") { await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, id)); await revokeCftLaunchLinks(id); }
    } else if (op === "delete") {
      if (self) throw new Error("You can't delete yourself");
      if (target.isSuperAdmin && !actor.isSuperAdmin) throw new Error("Only a super admin can delete a super admin");
      const [other] = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "owner"), eq(users.isActive, true), ne(users.id, id))).limit(1);
      if (target.role === "owner" && !other) throw new Error("Keep at least one active owner");
      await db.delete(users).where(eq(users.id, id));
    } else if (op === "resend") await issueMagicLink(target.email, "/admin");
    else if (op === "signout") await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, id));
    return id;
  }, { back: BACK, ok: { update: "User saved", deactivate: "User deactivated", activate: "User reactivated", delete: "User deleted", resend: "Sign-in link sent", signout: "Signed out everywhere" }[op] || "Done", entityId: () => id, revalidate: [BACK] });
}

// --- Integrations --------------------------------------------------------------
export async function integrationAction(formData: FormData) {
  const key = str(formData.get("key")); const op = str(formData.get("op"));
  await adminAction("integrations", "integration", op, async () => {
    const row = await db.query.integrations.findFirst({ where: eq(integrations.key, key) }); if (!row) throw new Error("Unknown integration");
    if (op === "config") { const cfg = tryJson<Record<string, unknown>>(str(formData.get("config")) || "{}", {}); await db.update(integrations).set({ config: { ...row.config, ...cfg }, updatedAt: new Date() }).where(eq(integrations.key, key)); }
    else if (op === "status") await db.update(integrations).set({ status: ["connected", "not_connected", "planned", "error"].includes(str(formData.get("status"))) ? str(formData.get("status")) : row.status, lastCheckedAt: new Date(), updatedAt: new Date() }).where(eq(integrations.key, key));
    else if (op === "check") { const s = await liveStatus(key); await db.update(integrations).set({ status: s, lastCheckedAt: new Date(), updatedAt: new Date() }).where(eq(integrations.key, key)); }
    return key;
  }, { back: BACK, ok: "Integration updated", entityId: (k) => k, revalidate: [BACK] });
}
/** Whether the required secrets for an integration are present in the environment. */
export async function integrationLiveStatus(key: string) { return liveStatus(key); }
async function liveStatus(key: string): Promise<string> {
  switch (key) {
    case "sendgrid": return env.sendgridApiKey ? "connected" : "not_connected";
    case "twilio": return cftSmsConfigured() || (env.twilio.sid && env.twilio.token && env.twilio.from) ? "connected" : "not_connected";
    case "cft": return env.cft.webhookSecret || env.cft.ssoSecret || env.cft.masterSecret ? "connected" : "not_connected";
    case "slack": return slackConfigured() ? "connected" : "not_connected";
    case "etsy": case "rss": return "connected";
    case "amazon": return (await getSetting("amazon")).associateTag || env.amazon.partnerTag || (env.amazon.accessKey && env.amazon.secretKey) ? "connected" : "not_connected";
    case "magnific": return env.magnificApiKey ? "connected" : "not_connected";
    case "meta": return env.social.meta.id && env.social.meta.secret ? "connected" : "not_connected";
    case "linkedin": return env.social.linkedin.id ? "connected" : "not_connected";
    case "pinterest": return env.social.pinterest.id ? "connected" : "not_connected";
    case "youtube": return env.social.youtube.id ? "connected" : "not_connected";
    case "stripe": return env.stripe.secret ? "connected" : "not_connected";
    case "esign": return "connected";
    case "hubspot": return env.hubspotToken ? "connected" : "not_connected";
    case "insta_newsletter": return await instaLiveStatus();
    default: return "planned";
  }
}
export async function saveSocialSettings(formData: FormData) {
  await adminAction("social", "setting", "update", async () => {
    const s = await getSetting("social");
    await setSetting("social", { ...s, showInstagramFeed: bool(formData.get("showInstagramFeed")), feedCount: parseNum(formData.get("feedCount"), 6) || 6, autoShare: { facebook: bool(formData.get("as_facebook")), linkedin: bool(formData.get("as_linkedin")), instagram: bool(formData.get("as_instagram")), pinterest: bool(formData.get("as_pinterest")) } });
    return "social";
  }, { back: str(formData.get("_back")).startsWith("/admin") ? str(formData.get("_back")) : "/admin/social", ok: "Social settings saved", entityId: (k) => k, revalidate: ["/admin/social", "/admin/content/posts", "/"] });
}
