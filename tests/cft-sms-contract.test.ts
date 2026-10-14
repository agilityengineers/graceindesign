/**
 * Contract test: a fake Call Flow Tracker that implements exactly the two routes this app relies on
 * (`GET /sso/launch?token=…&return=json` and `POST /api/messages/send`), driven by the real client.
 * No database is touched: the sender is configured by email, so no GID user lookup happens.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { verifyCftLaunchToken } from "../src/lib/cft-launch-token";

const SECRET = "shared-master-dashboard-secret";
const APP_ID = "608c99a8-0a2b-41d7-8930-f2dc3b0fe964";
const FROM = "+17706911600";

type Seen = { launches: { sub: string; email: string; returnJson: boolean }[]; sends: { auth: string | undefined; body: any }[] };
const seen: Seen = { launches: [], sends: [] };
let sessionCounter = 0;
let rejectSessionsBefore = 0; // sessions with a number below this get a 401 (simulates expiry)
let refuseLaunches = false;
let server: http.Server;
let cft: typeof import("../src/lib/server/cft-master");

before(async () => {
  server = http.createServer((req, res) => {
    const u = new URL(req.url || "/", "http://x");
    const json = (code: number, body: unknown) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
    if (req.method === "GET" && u.pathname === "/sso/launch") {
      const v = verifyCftLaunchToken(u.searchParams.get("token") || "", SECRET, APP_ID);
      if (!v.ok || refuseLaunches) return json(401, { error: "unauthorized" });
      seen.launches.push({ sub: v.payload.sub, email: v.payload.email, returnJson: u.searchParams.get("return") === "json" });
      const id = ++sessionCounter;
      if (u.searchParams.get("return") === "json") return json(200, { ok: true, sessionId: `sess-${id}`, userId: 42 });
      res.writeHead(302, { location: "/" }); return res.end();
    }
    if (req.method === "POST" && u.pathname === "/api/messages/send") {
      let raw = ""; req.on("data", (c) => (raw += c)); req.on("end", () => {
        const auth = req.headers.authorization;
        const n = Number((auth || "").replace("Bearer sess-", ""));
        if (!auth || !n || n < rejectSessionsBefore) return json(401, { error: "Invalid or expired session" });
        const body = JSON.parse(raw || "{}");
        seen.sends.push({ auth, body });
        if (!body.from || !body.to || !body.body) return json(400, { error: "Missing required fields: from, to, body" });
        return json(200, { success: true, message: { status: "queued" }, messageSid: `SM${n}` });
      });
      return;
    }
    json(404, { error: "not_found" });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  process.env.CFT_URL = `http://127.0.0.1:${port}/`;
  process.env.CFT_MASTER_DASHBOARD_SECRET = SECRET;
  process.env.CFT_MASTER_APP_ID = APP_ID;
  process.env.CFT_SMS_FROM = "(770) 691-1600";
  process.env.CFT_SMS_SENDER_EMAIL = "Info@GraceInDesign.net";
  cft = await import("../src/lib/server/cft-master");
});
after(() => server.close());

test("configuration is detected from the environment", () => {
  assert.equal(cft.cftMasterConfigured(), true);
  assert.equal(cft.cftSmsConfigured(), true);
});

test("first text mints a CFT session through /sso/launch?return=json, then sends from the tracking number", async () => {
  const r = await cft.sendSmsViaCft({ to: "404-555-0100", body: "New GID lead: Jane" });
  assert.equal(seen.launches.length, 1);
  assert.equal(seen.launches[0].email, "info@graceindesign.net");
  assert.equal(seen.launches[0].returnJson, true);
  assert.match(seen.launches[0].sub, /^gid:email:[0-9a-f]{32}$/);
  assert.equal(seen.sends.length, 1);
  assert.equal(seen.sends[0].auth, "Bearer sess-1");
  assert.deepEqual(seen.sends[0].body, { from: FROM, to: "+14045550100", body: "New GID lead: Jane" });
  assert.equal(r.messageSid, "SM1");
  assert.equal(r.from, FROM);
});

test("the session is reused for the next text (no second sign-in)", async () => {
  await cft.sendSmsViaCft({ to: "+14045550100", body: "second" });
  assert.equal(seen.launches.length, 1);
  assert.equal(seen.sends.length, 2);
  assert.equal(seen.sends[1].auth, "Bearer sess-1");
});

test("a 401 from CFT re-signs in once and retries, so an expired session never loses a text", async () => {
  rejectSessionsBefore = 2; // sess-1 is now dead
  const r = await cft.sendSmsViaCft({ to: "+14045550100", body: "third" });
  assert.equal(seen.launches.length, 2);
  assert.equal(seen.sends.at(-1)?.auth, "Bearer sess-2");
  assert.equal(r.messageSid, "SM2");
});

test("the browser entry URL points at CFT's /sso/launch with a token CFT accepts", () => {
  const url = cft.buildCftEntryUrl({ id: 7, email: "info@graceindesign.net", name: "Grace A. Williams" })!;
  const u = new URL(url);
  assert.equal(u.pathname, "/sso/launch");
  assert.equal(u.searchParams.get("return"), null);
  const v = verifyCftLaunchToken(u.searchParams.get("token")!, SECRET, APP_ID);
  assert.equal(v.ok, true);
  if (v.ok) assert.equal(v.payload.sub, "gid:user:7");
});

test("a refused token surfaces a clear error instead of a silent failure", async () => {
  refuseLaunches = true; // what CFT does when CFT_MASTER_DASHBOARD_SECRET does not match its MASTER_DASHBOARD_SECRET
  await assert.rejects(() => cft.getCftSession({ email: "someone@example.com" }, { fresh: true }), /Call Flow Tracker sign-in failed: CFT refused the SSO token/);
  rejectSessionsBefore = 99; // every cached session is dead too, so the retry must re-sign-in and hit the refusal
  await assert.rejects(() => cft.sendSmsViaCft({ to: "+14045550100", body: "x" }), /sign-in failed/);
  rejectSessionsBefore = 0;
  refuseLaunches = false;
});
