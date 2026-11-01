-- Newsletter: Insta-Newsletter is the list of record; these columns remember how each website sign-up's hand-off went
-- (src/lib/newsletter.ts for the status vocabulary) plus the consent evidence passed along with it.
ALTER TABLE "cc_subscribers" ADD COLUMN IF NOT EXISTS "insta_status" text;
--> statement-breakpoint
ALTER TABLE "cc_subscribers" ADD COLUMN IF NOT EXISTS "insta_contact_id" text;
--> statement-breakpoint
ALTER TABLE "cc_subscribers" ADD COLUMN IF NOT EXISTS "insta_synced_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "cc_subscribers" ADD COLUMN IF NOT EXISTS "insta_error" text;
--> statement-breakpoint
ALTER TABLE "cc_subscribers" ADD COLUMN IF NOT EXISTS "consent_ip" text;
--> statement-breakpoint
ALTER TABLE "cc_subscribers" ADD COLUMN IF NOT EXISTS "source_page" text;
--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN IF NOT EXISTS "insta_status" text;
--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN IF NOT EXISTS "insta_contact_id" text;
--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN IF NOT EXISTS "insta_synced_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN IF NOT EXISTS "insta_error" text;
--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN IF NOT EXISTS "consent_ip" text;
--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN IF NOT EXISTS "source_page" text;
