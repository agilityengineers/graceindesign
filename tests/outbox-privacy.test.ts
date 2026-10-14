import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import sg from "@sendgrid/mail";
import { eq } from "drizzle-orm";
import { db, outbox, pool } from "../src/lib/db";
import { env } from "../src/lib/env";
import { deliverOutbox, retryOutbox, sendEmail } from "../src/lib/server/outbox";
import { purgeAuthOutboxBodies, readOutboxPreviews } from "../src/lib/server/outbox-privacy";

test("authentication outbox retention and previews", async () => {
  const ids: number[] = [];
  const originalSend = sg.send;
  const originalKey = env.sendgridApiKey;
  const originalLog = console.log, originalError = console.error;
  const logs: string[] = [];
  console.log = (...args) => { logs.push(args.join(" ")); };
  console.error = (...args) => { logs.push(args.join(" ")); };
  let calls = 0, fail = false;
  const credential = "synthetic-outbox-credential";
  const body = `Sign in: https://example.invalid/auth/verify#token=${credential}`;
  sg.send = (async (message: any) => {
    calls++;
    assert.equal(message.text, body);
    assert.equal(message.html, `<a href="${body.slice(9)}">Sign in</a>`);
    assert.equal(message.trackingSettings.clickTracking.enable, false);
    if (fail) throw new Error(`Provider echoed raw credential: ${credential}`);
    return [{ headers: { "x-message-id": "synthetic-provider-id" } }];
  }) as typeof sg.send;
  async function insert(values: Partial<typeof outbox.$inferInsert> = {}) {
    const [row] = await db.insert(outbox).values({
      channel: "email", toAddr: "outbox-test@example.invalid",
      subject: "Test sign-in", bodyText: body,
      bodyHtml: `<a href="${body.slice(9)}">Sign in</a>`,
      authExpiresAt: new Date(Date.now() + 60_000), ...values,
    }).returning();
    ids.push(row.id);
    return row.id;
  }
  async function read(id: number) {
    return (await db.select().from(outbox).where(eq(outbox.id, id)))[0];
  }
  function cleared(row: any) {
    assert.equal(row.bodyText, null);
    assert.equal(row.bodyHtml, null);
    assert.equal(row.attachments, null);
  }
  try {
    // Invalid usage must not persist an unmarked credential.
    await assert.rejects(sendEmail({ to: "outbox-test@example.invalid", subject: "Test", text: body }));
    env.sendgridApiKey = "";
    const logged = await insert();
    cleared(await deliverOutbox(logged));
    cleared(await read(logged));
    assert.equal((await read(logged)).status, "logged");
    assert.equal((await read(logged)).provider, "console");

    env.sendgridApiKey = "SG.synthetic.not-a-real-key";
    const sent = await insert();
    cleared(await deliverOutbox(sent));
    const stored = await read(sent);
    cleared(stored);
    assert.equal(stored.status, "sent");
    assert.equal(stored.providerId, "synthetic-provider-id");
    assert.ok(stored.sentAt);
    await deliverOutbox(sent);
    await deliverOutbox(logged);
    await assert.rejects(retryOutbox(sent), /cannot be resent/);
    await assert.rejects(retryOutbox(logged), /cannot be resent/);
    assert.equal((await read(sent)).status, "sent");
    assert.equal((await read(logged)).status, "logged");
    assert.equal(calls, 1, "terminal auth messages cannot be resent");

    fail = true;
    const retry = await insert();
    cleared(await deliverOutbox(retry));
    assert.equal((await read(retry)).bodyText, body, "retry retains payload");
    const preview = (await readOutboxPreviews()).find(r => r.id === retry)!;
    assert.ok(preview);
    assert.ok(!JSON.stringify(preview).includes(credential));
    assert.equal(preview.error, null);
    fail = false;
    await retryOutbox(retry);
    cleared(await read(retry));
    assert.equal((await read(retry)).attempts, 2);

    fail = true;
    const exhausted = await insert();
    await deliverOutbox(exhausted);
    await deliverOutbox(exhausted);
    await deliverOutbox(exhausted);
    cleared(await read(exhausted));
    const before = calls;
    await deliverOutbox(exhausted);
    const expired = await insert({ authExpiresAt: new Date(Date.now() - 1) });
    await assert.rejects(retryOutbox(exhausted), /cannot be resent/);
    await assert.rejects(retryOutbox(expired), /cannot be resent/);
    await deliverOutbox(expired);
    cleared(await read(expired));
    assert.equal(calls, before, "expired and exhausted messages never reach provider");

    const queuedExpired = await insert({ authExpiresAt: new Date(Date.now() - 1) });
    const oldSent = await insert({ status: "sent" });
    const ordinary = await insert({ authExpiresAt: null, bodyText: "Ordinary message", bodyHtml: "<p>Ordinary message</p>" });
    await purgeAuthOutboxBodies();
    cleared(await read(queuedExpired));
    cleared(await read(oldSent));
    assert.equal((await read(ordinary)).bodyText, "Ordinary message");
    env.sendgridApiKey = "";
    await deliverOutbox(ordinary);
    assert.equal((await read(ordinary)).bodyText, "Ordinary message");
    assert.ok(!logs.join("\n").includes(credential), "credentials stay out of logs and errors");
  } finally {
    sg.send = originalSend;
    env.sendgridApiKey = originalKey;
    console.log = originalLog; console.error = originalError;
    for (const id of ids) await db.delete(outbox).where(eq(outbox.id, id));
    await pool.end();
  }
});
