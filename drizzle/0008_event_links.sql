-- Events get a region (Caribbean, United States), a US city/state, and their own page at /events/<slug>.
-- Existing events stay Caribbean; events that are already published (so already approved) get their link now,
-- made from the title the same way the app does it (src/lib/events.ts), with the event id added when two titles match.
ALTER TABLE "cc_events" ADD COLUMN IF NOT EXISTS "region" text DEFAULT 'caribbean' NOT NULL;--> statement-breakpoint
ALTER TABLE "cc_events" ADD COLUMN IF NOT EXISTS "city" text;--> statement-breakpoint
ALTER TABLE "cc_events" ADD COLUMN IF NOT EXISTS "state" text;--> statement-breakpoint
ALTER TABLE "cc_events" ADD COLUMN IF NOT EXISTS "slug" text;--> statement-breakpoint
WITH base AS (
	SELECT "id", COALESCE(NULLIF(trim(both '-' from left(trim(both '-' from regexp_replace(lower("title"), '[^a-z0-9]+', '-', 'g')), 70)), ''), 'event') AS b
	FROM "cc_events" WHERE "status" = 'published' AND "slug" IS NULL
), numbered AS (
	SELECT "id", b, row_number() OVER (PARTITION BY b ORDER BY "id") AS rn FROM base
)
UPDATE "cc_events" e SET "slug" = CASE WHEN n.rn = 1 THEN n.b ELSE n.b || '-' || e."id" END
FROM numbered n WHERE e."id" = n."id";--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "cc_events" ADD CONSTRAINT "cc_events_slug_unique" UNIQUE("slug");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
