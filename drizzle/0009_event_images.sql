-- An optional picture for each event, added by the admin (Admin → Events → upload or choose from the media library).
-- Public submissions don't include one; events without a picture use the designed date header instead.
ALTER TABLE "cc_events" ADD COLUMN IF NOT EXISTS "image_url" text;
