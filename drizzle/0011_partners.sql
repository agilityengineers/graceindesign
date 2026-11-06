-- AIP Partners directory: curated listings of independent professionals GID knows or has worked with
-- (Admin → Content → Partner directory). Rendered on /healthy-home-resources/aip-partners by the partner_directory block.
CREATE TABLE IF NOT EXISTS "partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"specialty" text,
	"category" text DEFAULT 'Other' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"url" text,
	"image_url" text,
	"location" text,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "partners_status_idx" ON "partners" USING btree ("status","category","sort");
