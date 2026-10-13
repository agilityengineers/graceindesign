// Dev-only real-browser auth check. No application auth is mocked or bypassed.
// Run ONLY with server stdout/stderr suppressed: development email logs contain tokens.
// AUTH_SERVER_LOGS_SUPPRESSED=1 node tests/auth-smoke.mjs
// Requires DATABASE_URL, REPLIT_DEV_DOMAIN (or AUTH_SMOKE_BASE), and Chromium.
// Never enables tracing, request logging, screenshots, or raw error output.
import { chromium } from "playwright";
import pg from "pg";
import { randomUUID, createHash } from "node:crypto";

const check = (name, ok) => {
  if (!ok) throw new Error(name);
  console.log(`PASS ${name}`);
};
const base = process.env.AUTH_SMOKE_BASE || `https://${process.env.REPLIT_DEV_DOMAIN}`;
const email = `auth-smoke-${randomUUID()}@example.invalid`;
let pool, browser, userId;
let stage = "safety preconditions";
try {
  check(stage, process.env.AUTH_SERVER_LOGS_SUPPRESSED === "1"
    && !process.env.SENDGRID_API_KEY && process.env.NODE_ENV !== "production"
    && !!process.env.DATABASE_URL && !!process.env.BASE_URL
    && (process.env.AUTH_SMOKE_BASE || process.env.REPLIT_DEV_DOMAIN));
  // BASE_URL is only checked for presence; its secret value is never read or printed.
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  stage = "create isolated active owner";
  ({ rows: [{ id: userId }] } = await pool.query(
    "insert into users (email, name, role) values ($1, 'Auth Smoke', 'owner') returning id", [email]));
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium",
    args: ["--no-sandbox"],
  });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", () => errors.push(true));
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(120000);
  const goto = (path) => page.goto(new URL(path, base).href, { waitUntil: "networkidle" });
  const pathIs = (path) => new URL(page.url()).pathname === path;
  const noSession = async () => !(await ctx.cookies()).some(c => c.name === "gid_session");
  const requestLink = async (address = email, next = "/admin") => {
    await goto(`/login?next=${encodeURIComponent(next)}`);
    await page.locator('input[name="email"]').fill(address);
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await page.waitForURL(u => u.pathname === "/login" && u.searchParams.get("sent") === "1");
    return page.getByRole("link", { name: "open sign-in link" });
  };
  stage = "signed-out admin is gated";
  await goto("/admin");
  check(stage, pathIs("/login") && await noSession());
  stage = "unknown address gets generic confirmation without a link";
  await requestLink(`unknown-${email}`);
  check(stage, await page.getByText("Check your email.", { exact: true }).isVisible()
    && await page.getByRole("link", { name: "open sign-in link" }).count() === 0);

  stage = "existing magic-link request and BASE_URL origin";
  let link = await requestLink();
  let href = await link.getAttribute("href");
  const linkUrl = new URL(href);
  check("generated link targets auth verification", linkUrl.pathname === "/auth/verify");
  const sameOrigin = linkUrl.origin === new URL(base).origin;
  const localOrigin = ["localhost", "127.0.0.1"].includes(linkUrl.hostname) && linkUrl.port === "5000";
  console.log(`CHECK generated link uses preview origin: ${sameOrigin ? "yes" : "no"}`);
  console.log(`CHECK generated link uses local development server: ${localOrigin ? "yes" : "no"}`);
  if (!sameOrigin) {
    console.log("FAIL BASE_URL origin differs from this preview; remaining checks use browser-only origin remapping");
    process.exitCode = 1;
    // Never send a token to another deployment. This intercept happens before networking.
    // Preserve the path/query, but keep requests and cookies on this preview.
    await ctx.route(`${linkUrl.origin}/**`, async route => {
      const target = new URL(route.request().url());
      const response = await ctx.request.get(new URL(target.pathname + target.search, base).href, { maxRedirects: 0 });
      const location = response.headers().location;
      if (location) {
        const redirect = new URL(location, base);
        await route.fulfill({ status: 303, headers: {
          location: new URL(redirect.pathname + redirect.search, base).href,
        } });
      } else {
        await route.fulfill({ response });
      }
    });
  }
  const hash = createHash("sha256").update(new URL(href).searchParams.get("token")).digest("hex");
  let tokenRows = await pool.query("select used_at, expires_at from magic_link_tokens where token_hash=$1 and email=$2", [hash, email]);
  check("request stores an unused expiring token hash", tokenRows.rowCount === 1
    && !tokenRows.rows[0].used_at && tokenRows.rows[0].expires_at > new Date());
  const mail = await pool.query("select status, provider from outbox where to_addr=$1", [email]);
  check("development email is logged, not sent", mail.rowCount === 1
    && mail.rows[0].status === "logged" && mail.rows[0].provider === "console");
  stage = "magic link reaches rendered admin";
  await link.click();
  await page.waitForURL(u => u.pathname === "/admin");
  await page.getByRole("link", { name: "Sign out", exact: true }).waitFor();
  check(stage, pathIs("/admin"));
  const cookie = (await ctx.cookies()).find(c => c.name === "gid_session");
  stage = "session cookie attributes";
  console.log("CHECK cookie attributes", JSON.stringify(cookie ? {
    httpOnly: cookie.httpOnly, sameSite: cookie.sameSite, rootPath: cookie.path === "/",
    persistent: cookie.expires > Date.now() / 1000, secure: cookie.secure,
  } : { present: false }));
  check("session cookie is HTTP-only, SameSite=Lax, root-scoped and persistent",
    cookie?.httpOnly && cookie.sameSite === "Lax" && cookie.path === "/"
    && cookie.expires > Date.now() / 1000);
  check("session is recorded as magic-link login", (await pool.query(
    "select 1 from sessions where user_id=$1 and source='magic_link' and revoked_at is null and expires_at > now()", [userId])).rowCount === 1);
  check("token is consumed", !!(await pool.query(
    "select used_at from magic_link_tokens where token_hash=$1", [hash])).rows[0].used_at);
  stage = "session survives reload and protected navigation";
  await page.reload({ waitUntil: "networkidle" });
  await goto("/admin/leads");
  check(stage, pathIs("/admin/leads") && await page.getByRole("link", { name: "Sign out", exact: true }).isVisible());
  stage = "signed-in login redirects to admin";
  await goto("/login");
  check(stage, pathIs("/admin"));
  stage = "GET sign-out clears cookie and revokes session";
  await page.getByRole("link", { name: "Sign out", exact: true }).click();
  await page.waitForURL(u => u.pathname === "/login");
  check(stage, await noSession() && (await pool.query(
    "select 1 from sessions where user_id=$1 and revoked_at is not null", [userId])).rowCount === 1);
  stage = "revoked cookie cannot regain access";
  await ctx.addCookies([cookie]);
  await goto("/admin");
  check(stage, pathIs("/login"));
  await ctx.clearCookies();
  stage = "used magic link is rejected";
  await goto(href);
  check(stage, pathIs("/login") && new URL(page.url()).searchParams.get("err") === "invalid" && await noSession());
  stage = "invalid token is rejected";
  await goto(new URL("/auth/verify?token=invalid-test-value", linkUrl.origin).href);
  check(stage, pathIs("/login") && new URL(page.url()).searchParams.get("err") === "invalid" && await noSession());

  stage = "expired magic link is rejected";
  link = await requestLink();
  href = await link.getAttribute("href");
  await pool.query("update magic_link_tokens set expires_at=now()-interval '1 minute' where email=$1 and used_at is null", [email]);
  await goto(href);
  check(stage, pathIs("/login") && new URL(page.url()).searchParams.get("err") === "invalid" && await noSession());
  stage = "requested internal destination works";
  link = await requestLink(email, "/admin/leads");
  await link.click();
  await page.waitForURL(u => u.pathname === "/admin/leads");
  check(stage, await page.getByRole("link", { name: "Sign out", exact: true }).isVisible());
  stage = "POST sign-out redirects to login and clears session";
  const response = await ctx.request.post(new URL("/auth/signout", base).href, { maxRedirects: 0 });
  check(stage, response.status() === 303
    && new URL(response.headers().location).origin === linkUrl.origin
    && new URL(response.headers().location).pathname === "/login" && await noSession());
  await goto("/admin");
  check("admin is gated again after POST sign-out", pathIs("/login"));
  check("all test sessions are revoked", (await pool.query(
    "select 1 from sessions where user_id=$1 and revoked_at is null", [userId])).rowCount === 0);
  check("no browser runtime errors", errors.length === 0);
} catch {
  // Browser/database errors can contain token URLs or connection details.
  console.error(`FAIL ${stage} (sensitive diagnostics withheld)`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (pool) {
    try {
      await pool.query("delete from outbox where to_addr=$1", [email]);
      await pool.query("delete from magic_link_tokens where email=$1", [email]);
      if (userId) await pool.query("delete from users where id=$1", [userId]);
      console.log("PASS temporary account, sessions, tokens and email records removed");
    } catch {
      console.error("FAIL test data cleanup (sensitive diagnostics withheld)");
      process.exitCode = 1;
    }
    await pool.end();
  }
}
