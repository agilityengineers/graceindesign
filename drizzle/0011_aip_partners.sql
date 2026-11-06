-- AIP Partners directory: trusted professionals shown on /healthy-home-resources/aip-partners, managed in Admin → Content → AIP Partners.
CREATE TABLE IF NOT EXISTS "aip_partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"service_type" text,
	"relationship" text DEFAULT 'known' NOT NULL,
	"service_area" text,
	"description" text,
	"website_url" text,
	"logo_url" text,
	"visible" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
