/**
 * Product catalog import — adds the seeded listings (src/lib/seed-data/products.ts) to an ALREADY-SEEDED database and moves the
 * AIP Products page copy from "our Etsy shop" to store-neutral wording, without touching anything edited in the admin.
 * The same import is one click in Admin → Products ("Import the previous site's products"); this is the terminal version.
 *
 *   npm run content:products -- --dry-run     # print every change, write nothing
 *   npm run content:products                  # add missing listings + page copy
 *   npm run content:products -- --images      # also copy each new listing's remote photo into the media store (self-hosted)
 *   npm run content:products -- --refresh     # also read price, photo and rating from the store page for each new listing
 *
 * Run `npm run db:migrate` first (adds products.retailer and products.description). Safe to run repeatedly: listings are matched
 * by URL and only inserted when missing; page text changes only where the current value still equals the earlier seeded wording.
 * Run it once against the workspace database and once with DATABASE_URL pointed at production (see docs/products.md).
 */
import "dotenv/config";
import { pool } from "../src/lib/db";
import { importProducts } from "../src/lib/server/product-import";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

async function main() {
  console.log(dryRun ? "Dry run — nothing will be written.\n" : "Applying product catalog changes…\n");
  const r = await importProducts({ dryRun, images: args.includes("--images"), refresh: args.includes("--refresh"), log: console.log });
  console.log(`\n${r.changes.length} change(s) ${dryRun ? "would be applied" : "applied"}; ${r.added} listing(s) ${dryRun ? "to add" : "added"}, ${r.alreadyPresent} already present.`);
  if (!dryRun && r.added) console.log("Next: open Admin → Products, press “Refresh prices & photos”, then check the cards and reorder or feature listings as needed.");
  await pool.end();
}
main().catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
