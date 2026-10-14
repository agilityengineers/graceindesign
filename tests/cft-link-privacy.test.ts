import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
import { db, outbox, cftLaunchLinks, pool } from "../src/lib/db";
import { env } from "../src/lib/env";
import { createCftLaunchLink, consumeCftLaunchLink } from "../src/lib/server/cft-links";
import { sendSms } from "../src/lib/server/outbox";
import { readOutboxPreviews, purgeAuthOutboxBodies } from "../src/lib/server/outbox-privacy";
import { notifySlack } from "../src/lib/server/slack";
import { sha256Hex } from "../src/lib/server/crypto";

test("CFT credentials are single-use, short-lived, and hidden from logs and outbox", async () => {
  const cft = { ...env.cft }, twilio = { ...env.twilio }, webhook = env.slack.webhookUrl;
  const logs: string[] = [], ids: number[] = [], hashes: string[] = [];
  const log = console.log, error = console.error;
  console.log = console.error = (...args) => { logs.push(args.join(" ")); };
  try {
    env.cft.url = "https://example.invalid";
    env.cft.masterSecret = ""; env.cft.smsFrom = "";
    env.twilio.sid = ""; env.twilio.token = ""; env.twilio.from = "";
    env.slack.webhookUrl = "";
    const link = await createCftLaunchLink({ person: { email: "privacy-test@example.invalid", name: "Test" } });
    assert.ok(link);
    const url = new URL(link.url);
    assert.equal(url.pathname, "/go/cft");
    const token = new URLSearchParams(url.hash.slice(1)).get("token")!;
    hashes.push(sha256Hex(token));
    assert.equal(token.length, 43);
    assert.ok(link.expiresAt.getTime() - Date.now() <= 20 * 60_000);
    await notifySlack({ title: "Test", buttons: [{ label: "Open", url: link.url }] });
    const sms = await sendSms({ to: "+12025550123", body: link.url, authExpiresAt: link.expiresAt });
    assert.ok(sms); ids.push(sms.id);
    assert.equal(sms.bodyText, null);
    const [stored] = await db.select().from(outbox).where(eq(outbox.id, sms.id));
    assert.equal(stored.bodyText, null);
    assert.ok(stored.authExpiresAt);
    const [queued] = await db.insert(outbox).values({ channel: "sms", toAddr: "+12025550123", bodyText: link.url, authExpiresAt: link.expiresAt }).returning();
    ids.push(queued.id);
    const previews = await readOutboxPreviews();
    assert.equal(previews.find(p => p.id === queued.id)?.bodyText, "[Sign-in content hidden]");
    await db.update(outbox).set({ authExpiresAt: new Date(0) }).where(eq(outbox.id, queued.id));
    await purgeAuthOutboxBodies();
    assert.equal((await db.select().from(outbox).where(eq(outbox.id, queued.id)))[0].bodyText, null);
    const results = await Promise.all(Array.from({ length: 4 }, () => consumeCftLaunchLink(token)));
    assert.equal(results.filter(r => r.ok).length, 1);
    assert.equal((await consumeCftLaunchLink("x".repeat(32))).ok, false);
    for (const reason of ["expired", "revoked"] as const) {
      const another = await createCftLaunchLink({ person: { email: "privacy-test@example.invalid", name: "Test" } });
      assert.ok(another);
      const otherToken = new URLSearchParams(new URL(another.url).hash.slice(1)).get("token")!;
      const hash = sha256Hex(otherToken); hashes.push(hash);
      await db.update(cftLaunchLinks).set(reason === "expired" ? { expiresAt: new Date(0) } : { revokedAt: new Date() })
        .where(eq(cftLaunchLinks.tokenHash, hash));
      assert.equal((await consumeCftLaunchLink(otherToken)).ok, false);
    }
    const [legacy] = await db.insert(outbox).values({ channel: "sms", toAddr: "+12025550123", bodyText: "https://example.invalid/go/cft/old-credential" }).returning();
    ids.push(legacy.id);
    await purgeAuthOutboxBodies();
    assert.equal((await db.select().from(outbox).where(eq(outbox.id, legacy.id)))[0].bodyText, null);
    assert.ok(logs.every(line => !line.includes(token)));
  } catch {
    // Database errors can include bound values. Never let the runner retain them.
    throw new Error("CFT privacy assertion failed; credential-bearing diagnostics suppressed");
  } finally {
    console.log = log; console.error = error;
    Object.assign(env.cft, cft); Object.assign(env.twilio, twilio); env.slack.webhookUrl = webhook;
    if (ids.length) await db.delete(outbox).where(inArray(outbox.id, ids));
    if (hashes.length) await db.delete(cftLaunchLinks).where(inArray(cftLaunchLinks.tokenHash, hashes));
    await pool.end();
  }
});
