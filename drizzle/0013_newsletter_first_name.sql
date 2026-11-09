-- Healthy Home checklist: the sign-up form now asks for a first name, forwarded to Insta-Newsletter as the contact's firstName
-- and shown in Admin → Newsletter (src/lib/server/walkthrough.ts).
ALTER TABLE "newsletter_subscribers" ADD COLUMN IF NOT EXISTS "first_name" text;
