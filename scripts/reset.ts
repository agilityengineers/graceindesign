import "dotenv/config";
import { pool } from "../src/lib/db";

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DB_RESET !== "1") { console.error("Refusing to reset a production database (set ALLOW_DB_RESET=1 to override)."); process.exit(1); }
  console.log("Dropping public schema …");
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await pool.end();
  console.log("Done. Run `npm run db:setup` to migrate and seed.");
}
main().catch((e) => { console.error(e); process.exit(1); });
