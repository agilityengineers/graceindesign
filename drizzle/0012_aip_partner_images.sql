-- AIP Partners: how each listing's image is shown (a logo whole on a light tile, or a photo cropped to fill it) and a record
-- of permission to reproduce it (e.g. a logo taken from the partner's website), set in Admin → Content → AIP Partners.
ALTER TABLE "aip_partners" ADD COLUMN IF NOT EXISTS "image_kind" text DEFAULT 'logo' NOT NULL;--> statement-breakpoint
ALTER TABLE "aip_partners" ADD COLUMN IF NOT EXISTS "image_permission" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "aip_partners" ADD COLUMN IF NOT EXISTS "image_source" text;
