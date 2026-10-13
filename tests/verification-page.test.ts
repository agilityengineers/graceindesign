import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { verificationPage } from "../src/lib/auth/verification-page";

const token = "a".repeat(43);
async function run(hash: string, search = "", scrubFails = false) {
  const events: string[] = [];
  const requests: { url: string; options: RequestInit }[] = [];
  const html = verificationPage("test-nonce");
  const script = html.match(/<script nonce="test-nonce">([\s\S]*?)<\/script>/)![1];
  vm.runInNewContext(script, {
    URLSearchParams,
    window: {
      location: { hash, search, replace: (url: string) => events.push(`navigate:${url}`) },
      history: { replaceState: (_state: unknown, _title: string, url: string) => {
        events.push(`scrub:${url}`);
        if (scrubFails) throw new Error("Unavailable");
      } },
    },
    fetch: (url: string, options: RequestInit) => {
      events.push("post");
      requests.push({ url, options });
      return Promise.resolve({ ok: true, json: async () => ({ location: "/admin" }) });
    },
  });
  await new Promise(resolve => setImmediate(resolve));
  return { events, requests, html };
}

test("scrubs before POST; credential only in body; replaces final navigation", async () => {
  const { events, requests, html } = await run(`#token=${token}`);
  assert.deepEqual(events, ["scrub:/auth/verify", "post", "navigate:/admin"]);
  assert.equal(requests[0].url, "/auth/verify");
  assert.equal(requests[0].options.method, "POST");
  assert.equal(requests[0].options.body, JSON.stringify({ token }));
  assert.equal(requests[0].options.referrerPolicy, "no-referrer");
  assert.equal(requests[0].options.redirect, "error");
  assert.equal(requests[0].options.cache, "no-store");
  assert.ok(!html.includes(token));
  assert.ok(!html.includes(" src="));
});

test("missing, malformed and legacy query tokens are scrubbed but not exchanged", async () => {
  for (const [hash, search] of [["", ""], ["#token=bad", ""], ["", `?token=${token}`], [`#token=${token}`, "?old=1"]]) {
    const { requests, events } = await run(hash, search);
    assert.equal(requests.length, 0);
    assert.deepEqual(events, ["scrub:/auth/verify", "navigate:/login?err=invalid"]);
  }
});

test("history failure never proceeds with the credential exchange", async () => {
  const { requests, events } = await run(`#token=${token}`, "", true);
  assert.equal(requests.length, 0);
  assert.deepEqual(events, ["scrub:/auth/verify", "navigate:/login?err=invalid"]);
});
