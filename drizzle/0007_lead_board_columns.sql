-- Leads board columns become editable (Admin → Leads → Board → Manage columns).
-- The stage was a fixed Postgres enum; it is now text holding a lead_stages.key, and the seven existing columns are seeded
-- with the same names and colours so nothing changes on screen until someone edits them.
CREATE TABLE IF NOT EXISTS "lead_stages" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"bg" text DEFAULT '#f2f4f7' NOT NULL,
	"fg" text DEFAULT '#4b5569' NOT NULL,
	"auto_delete_days" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "lead_stages" ("key", "label", "sort", "bg", "fg") VALUES
	('new', 'New', 0, '#e6f3fc', '#1a2238'),
	('contacted', 'Contacted', 1, '#fff4d6', '#7a5a00'),
	('consultation_booked', 'Consultation booked', 2, '#e9e4fb', '#4a2fa3'),
	('proposal_sent', 'Proposal sent', 3, '#dcefe4', '#1f6b3f'),
	('won', 'Won', 4, '#1a2238', '#fff'),
	('lost', 'Lost', 5, '#f2f4f7', '#6b7486'),
	('nurture', 'Nurture', 6, '#fbe9e2', '#9a3c1e')
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "stage" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "stage" SET DATA TYPE text USING "stage"::text;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "stage" SET DEFAULT 'new';--> statement-breakpoint
ALTER TABLE "email_sequences" ALTER COLUMN "trigger_stage" SET DATA TYPE text USING "trigger_stage"::text;--> statement-breakpoint
-- When the lead entered its current column; an auto-delete column (e.g. Trash, 14 days) counts from here.
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "stage_changed_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "leads" SET "stage_changed_at" = "updated_at";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."lead_stage";
