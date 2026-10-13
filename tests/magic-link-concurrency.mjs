// Uses the real verification route and PostgreSQL. Stop the normal workflow first.
// Diagnostics are deliberately limited to fixed labels; never dump errors,
// response headers/bodies, tokens, cookies, SQL parameters, or captured logs.
import { spawn } from "node:child_process";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { once } from "node:events";
import pg from "pg";

const base = "http://127.0.0.1:5000";
const email = `concurrency-${randomUUID()}@example.invalid`;
const applicationName = `magic-link-test-${randomUUID()}`;
const concurrency = 8;
const credentials = [];
let pool, server, locker, userId, pending = [], output = "", stage = "preconditions";
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const check = (label, ok) => {
  if (!ok) throw new Error("Check failed");
  console.log(`PASS ${label}`);
};
const verify = token => fetch(`${base}/auth/verify?token=${encodeURIComponent(token)}`, {
  redirect: "manual", signal: AbortSignal.timeout(60000),
});
const sessionCookie = response => response.headers.getSetCookie().some(value => value.startsWith("gid_session="));
async function invalid(response) {
  const location = new URL(response.headers.get("location"), base);
  check("rejected verification has no session and a generic error",
    response.status === 307 && !sessionCookie(response)
    && location.pathname + location.search === "/login?err=invalid");
  const content = [...response.headers].flat().join("\n") + await response.text();
  check("rejection does not disclose credentials", credentials.every(value => !content.includes(value)));
}
async function issue({ expired = false, used = false, missingUser = false } = {}) {
  const token = randomBytes(32).toString("hex");
  credentials.push(token);
  const hash = createHash("sha256").update(token).digest("hex");
  await pool.query(`insert into magic_link_tokens (email, token_hash, expires_at, used_at, redirect_to)
    values ($1, $2, $3, $4, '/admin')`,
  [missingUser ? `missing-${email}` : email, hash,
    new Date(Date.now() + (expired ? -60000 : 1200000)), used ? new Date() : null]);
  return { token, hash };
}
try {
  check(stage, !!process.env.DATABASE_URL && process.env.NODE_ENV !== "production");
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  stage = "isolated account setup";
  ({ rows: [{ id: userId }] } = await pool.query(
    "insert into users (email, name) values ($1, 'Concurrency Check') returning id", [email]));
  stage = "test server startup";
  server = spawn(process.execPath, ["scripts/next-safe.mjs", "dev", "-p", "5000", "-H", "0.0.0.0"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PG_POOL_MAX: String(concurrency + 2), PGAPPNAME: applicationName },
  });
  server.stdout.on("data", chunk => { output += chunk; });
  server.stderr.on("data", chunk => { output += chunk; });
  for (let i = 0; i < 240 && !output.includes("Ready") && server.exitCode === null; i++) await pause(250);
  check(stage, output.includes("Ready") && server.exitCode === null);
  // Compile the route before holding the database lock.
  await invalid(await verify("synthetic-invalid"));
  stage = "concurrent verification";
  const { token, hash } = await issue();
  locker = await pool.connect();
  await locker.query("begin");
  await locker.query("select id from magic_link_tokens where token_hash=$1 for update", [hash]);
  // Hold the row until ALL requests reach their UPDATE. This also reliably
  // exposes the old SELECT-then-UPDATE race: all its SELECTs see unused state.
  pending = Array.from({ length: concurrency }, () => verify(token));
  const results = Promise.allSettled(pending);
  let blocked = 0;
  for (let i = 0; i < 200; i++) {
    const result = await pool.query(`select count(*)::int as count from pg_stat_activity
      where application_name=$1 and wait_event_type='Lock'
      and lower(query) like '%update%magic_link_tokens%'`, [applicationName]);
    blocked = result.rows[0].count;
    if (blocked === concurrency) break;
    await pause(100);
  }
  check("all eight requests contend for the same token", blocked === concurrency);
  await locker.query("commit");
  locker.release();
  locker = null;
  const settled = await results;
  check("all verification requests returned", settled.every(result => result.status === "fulfilled"));
  const responses = settled.map(result => result.value);
  const winners = responses.filter(sessionCookie);
  check("exactly one verification sets a session cookie", winners.length === 1);
  check("winner keeps the requested redirect",
    winners[0].status === 307 && new URL(winners[0].headers.get("location"), base).pathname === "/admin");
  for (const response of responses.filter(response => !sessionCookie(response))) await invalid(response);
  await invalid(await verify(token));
  stage = "other invalid token states";
  for (const options of [{ expired: true }, { used: true }, { missingUser: true }]) {
    await invalid(await verify((await issue(options)).token));
  }
  await pool.query("update users set is_active=false where id=$1", [userId]);
  await invalid(await verify((await issue()).token));
  const count = await pool.query("select count(*)::int as count from sessions where user_id=$1", [userId]);
  check("only one session exists after concurrency, replay, and invalid states", count.rows[0].count === 1);
  const claimed = await pool.query("select used_at is not null as used from magic_link_tokens where token_hash=$1", [hash]);
  check("winning token is marked used", claimed.rows[0].used);
  check("captured server diagnostics contain no issued tokens", credentials.every(value => !output.includes(value)));
} catch {
  console.error(`FAIL ${stage} (sensitive diagnostics withheld)`);
  process.exitCode = 1;
} finally {
  if (locker) {
    await locker.query("rollback").catch(() => { process.exitCode = 1; });
    locker.release();
  }
  await Promise.allSettled(pending);
  if (server && server.exitCode === null) {
    const closed = once(server, "close");
    server.kill("SIGTERM");
    await closed;
  }
  if (pool) {
    try {
      await pool.query("delete from magic_link_tokens where email=any($1::text[])", [[email, `missing-${email}`]]);
      if (userId) await pool.query("delete from users where id=$1", [userId]);
      console.log("PASS temporary authentication data removed");
    } catch {
      console.error("FAIL cleanup (sensitive diagnostics withheld)");
      process.exitCode = 1;
    }
    await pool.end();
  }
}
