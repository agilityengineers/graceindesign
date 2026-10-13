// Starts its own dev server; stop the normal workflow before running this test.
// No traces, response dumps, raw errors, credentials, or log files are emitted.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import pg from "pg";

const base = "http://127.0.0.1:5000";
const email = `log-check-${randomUUID()}@example.invalid`;
let server, pool, userId, output = "", stage = "preconditions";
const check = (name, ok) => {
  if (!ok) throw new Error("Check failed");
  console.log(`PASS ${name}`);
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  check(stage, !!process.env.DATABASE_URL && !process.env.SENDGRID_API_KEY
    && process.env.NODE_ENV !== "production");
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  stage = "isolated account setup";
  ({ rows: [{ id: userId }] } = await pool.query(
    "insert into users (email, name, role) values ($1, 'Log Check', 'owner') returning id", [email]));
  stage = "redacting launcher startup";
  server = spawn(process.execPath, ["scripts/next-safe.mjs", "dev", "-p", "5000", "-H", "0.0.0.0"],
    { stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.on("data", chunk => { output += chunk; });
  server.stderr.on("data", chunk => { output += chunk; });
  for (let i = 0; i < 120 && !output.includes("Ready") && server.exitCode === null; i++) await pause(250);
  check(stage, output.includes("Ready") && server.exitCode === null);
  stage = "login form and development email delivery";
  const page = await (await fetch(`${base}/login`)).text();
  const action = page.match(/name="(\$ACTION_ID_[^"]+)"/)?.[1];
  check("server-rendered login form is available", !!action);
  const form = new FormData();
  form.set(action, "");
  form.set("email", email);
  form.set("next", "/admin");
  const result = await fetch(`${base}/login`, { method: "POST", body: form, redirect: "manual" });
  const location = new URL(result.headers.get("location"), base);
  const dev = location.searchParams.get("dev");
  check("login returns the intact development link", result.status === 303 && !!dev);
  const token = new URL(dev).searchParams.get("token");
  check("development link includes an issued credential", !!token);
  // Keep all traffic local, irrespective of the fork's canonical URL setting.
  const sentPage = await (await fetch(new URL(location.pathname + location.search, base))).text();
  check("development link UI retains a working href",
    sentPage.includes(`href="${dev.replaceAll("&", "&amp;")}"`) && sentPage.includes("open sign-in link"));
  const mail = (await pool.query("select body_text, status from outbox where to_addr=$1", [email])).rows[0];
  check("email payload remains intact and is logged rather than sent",
    mail?.body_text.includes(dev) && mail.status === "logged");
  stage = "verification and invalid-link handling";
  const url = new URL(dev);
  const verified = await fetch(new URL(url.pathname + url.search, base), { redirect: "manual" });
  check("local verification issues a session",
    verified.status === 307 && !!verified.headers.get("set-cookie")?.includes("gid_session="));
  const invalid = await fetch(`${base}/auth/verify?token=synthetic-invalid`, { redirect: "manual" });
  check("invalid token retains its error redirect",
    new URL(invalid.headers.get("location"), base).searchParams.get("err") === "invalid");
  stage = "captured server diagnostics";
  for (let i = 0; i < 40 && !output.includes("GET /auth/verify?token=[REDACTED]"); i++) await pause(100);
  check("issued credentials absent from all captured stdout and stderr",
    !output.includes(token) && !output.includes(encodeURIComponent(dev)));
  check("email diagnostics omit sign-in content", output.includes("sign-in email content redacted"));
  check("login and verify logs retain paths and redact query values",
    /GET \/login\?sent=1&dev=\[REDACTED\] 200/.test(output)
    && /GET \/auth\/verify\?token=\[REDACTED\] 307/.test(output));
  check("startup and timing diagnostics remain visible", output.includes("Ready") && /\d+ms/.test(output));
} catch {
  console.error(`FAIL ${stage} (sensitive diagnostics withheld)`);
  process.exitCode = 1;
} finally {
  if (server && server.exitCode === null) {
    const closed = once(server, "close");
    server.kill("SIGTERM");
    await closed;
  }
  if (pool) {
    try {
      await pool.query("delete from outbox where to_addr=$1", [email]);
      await pool.query("delete from magic_link_tokens where email=$1", [email]);
      if (userId) await pool.query("delete from users where id=$1", [userId]);
      console.log("PASS temporary authentication data removed");
    } catch {
      console.error("FAIL cleanup (sensitive diagnostics withheld)");
      process.exitCode = 1;
    }
    await pool.end();
  }
}
