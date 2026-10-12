/** Replit Scheduled Deployment entrypoint: `npm run cron -- reminders` (or rss, etsy, social, drips, webhooks, outbox, hubspot, all). */
import "dotenv/config";
const job = process.argv[2] || "all";
async function main() {
  const { runJob, JOBS } = await import("../src/lib/server/cron");
  if (!JOBS.includes(job as any)) { console.error(`Unknown job "${job}". One of: ${JOBS.join(", ")}`); process.exit(1); }
  const result = await runJob(job as any);
  console.log(JSON.stringify({ job, result }, null, 2));
  const { pool } = await import("../src/lib/db"); await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
