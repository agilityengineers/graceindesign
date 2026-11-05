-- Per-event counters shown in Admin → Events: page views (once per browser tab session, people only), clicks on Register
-- (counted by /events/<slug>/register before it forwards to the registration site), calendar downloads and share clicks.
ALTER TABLE "cc_events" ADD COLUMN IF NOT EXISTS "view_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cc_events" ADD COLUMN IF NOT EXISTS "register_clicks" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cc_events" ADD COLUMN IF NOT EXISTS "calendar_adds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cc_events" ADD COLUMN IF NOT EXISTS "share_clicks" integer DEFAULT 0 NOT NULL;
