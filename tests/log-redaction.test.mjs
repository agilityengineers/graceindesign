import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { redactAuthUrls, formatEmailLog } from "../src/lib/server/log-redaction.mjs";
import { createLogRedactor } from "../scripts/log-redaction-stream.mjs";

// Deliberately fake fixtures only; never print issued credentials on failure.
const token = "synthetic-credential";
const verify = `/auth/verify?token=${token}`;
const login = `/login?sent=1&dev=${encodeURIComponent(`https://example.invalid${verify}`)}`;
function noCredential(text) {
  assert.ok(!text.includes(token), "credential must not appear in output");
}

test("login and verify preserve request diagnostics without credentials", () => {
  for (const url of [verify, login]) {
    const result = redactAuthUrls(` GET ${url} 307 in 42ms`);
    noCredential(result);
    assert.ok(result.includes("[REDACTED]"));
    assert.ok(result.endsWith("307 in 42ms"));
  }
  assert.equal(redactAuthUrls("POST /login?err=rate&next=%2Fadmin 303 in 12ms"),
    "POST /login?err=rate&next=%2Fadmin 303 in 12ms");
});

test("repeated, encoded, HTML and nested auth parameters are redacted", () => {
  for (const url of [
    `${verify}&token=${token}&next=/admin`,
    `/auth/verify?%74oken=${token}`,
    `/auth/verify#token=${token}`,
    encodeURIComponent(`/auth/verify#token=${token}`),
    `/login?dev-link=${token}`,
    `/login?devLink=${token}`,
    `/login?sent=1&amp;dev=${token}`,
    encodeURIComponent(verify), encodeURIComponent(encodeURIComponent(verify)),
    `/login?next=${encodeURIComponent(verify)}`,
  ]) noCredential(redactAuthUrls(url));
});

test("auth email body is omitted without changing the delivery payload", () => {
  const row = { toAddr: "test@example.invalid", subject: "Sign in", bodyText: `Hello\n${verify}\nExpires soon` };
  const before = JSON.stringify(row);
  const log = formatEmailLog(row);
  noCredential(log);
  assert.ok(log.includes("[outbox:email"));
  assert.ok(log.includes("sign-in email content redacted"));
  assert.equal(JSON.stringify(row), before);
  assert.ok(formatEmailLog({ ...row, bodyText: "Consultation booked" }).includes("Consultation booked"));
});

test("error messages retain reason and stack while removing auth URLs", () => {
  const log = redactAuthUrls(`Error: delivery failed for ${verify}\n    at deliver (outbox.ts:12)\n`);
  noCredential(log);
  assert.ok(log.includes("Error: delivery failed"));
  assert.ok(log.includes("at deliver"));
});

async function output(chunks) {
  const stream = createLogRedactor();
  let result = "";
  stream.on("data", chunk => { result += chunk.toString(); });
  for (const chunk of chunks) stream.write(chunk);
  stream.end();
  await once(stream, "end");
  return result;
}

test("stdout/stderr filter handles every chunk boundary and trailing error lines", async () => {
  const input = `✓ Ready\n GET ${login} 200 in 5ms\nError: ${verify}`;
  for (let i = 1; i < input.length; i++) {
    const result = await output([input.slice(0, i), input.slice(i)]);
    noCredential(result);
    assert.ok(result.includes("✓ Ready"));
    assert.ok(result.includes("200 in 5ms"));
    assert.ok(result.includes("Error: /auth/verify?token=[REDACTED]"));
  }
});

test("oversized partial lines fail closed and subsequent diagnostics survive", async () => {
  const result = await output(["x".repeat(70000), verify, "\nReady\n"]);
  noCredential(result);
  assert.equal(result, "[oversized log line omitted]\nReady\n");
});
