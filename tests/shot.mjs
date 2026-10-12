// Dev-only screenshot helper. Usage:
//   node tests/shot.mjs [--login you@example.com] /path1 /path2 …
// Writes full-page JPEGs to $SHOT_OUT (default ./.data/shots). Requires the dev server on :5000.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import crypto from "node:crypto";
import pg from "pg";

const args = process.argv.slice(2);
let login = null;
const li = args.indexOf("--login"); if (li >= 0) { login = args[li + 1]; args.splice(li, 2); }
const out = process.env.SHOT_OUT || ".data/shots"; mkdirSync(out, { recursive: true });
const base = process.env.SHOT_BASE || "http://127.0.0.1:5000";
const pages = args.length ? args : ["/", "/services", "/services/residential", "/caribbean-connection", "/contact", "/healthy-home-resources/aip-products"];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 0.5 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`[${page.url()}] ${e.message}`));
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(`[console ${page.url()}] ${m.text().slice(0, 200)}`); });

if (login) {
  // Mint a one-time magic link straight in the database (same shape the app issues) and consume it.
  const url = process.env.DATABASE_URL || (await import("node:fs")).readFileSync(".env", "utf8").match(/^DATABASE_URL=(.*)$/m)?.[1]?.replace(/^"|"$/g, "");
  const pool = new pg.Pool({ connectionString: url });
  const token = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  await pool.query(`insert into magic_link_tokens (email, token_hash, redirect_to, expires_at) values ($1,$2,'/admin', now() + interval '10 minutes')`, [login.toLowerCase(), hash]);
  await pool.end();
  await page.goto(`${base}/auth/verify?token=${encodeURIComponent(token)}`, { waitUntil: "networkidle", timeout: 120000 });
  console.log("logged in as", login, "→", page.url());
}

for (const p of pages) {
  await page.goto(base + p, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(800);
  const name = p === "/" ? "home" : p.replace(/^\//, "").replace(/[\/?=&]/g, "_");
  await page.screenshot({ path: `${out}/${name}.jpg`, fullPage: true, type: "jpeg", quality: 60 });
  console.log("shot", name, "→", page.url());
}
console.log("ERRORS:", errors.length ? "\n" + errors.join("\n") : "none");
await browser.close();
