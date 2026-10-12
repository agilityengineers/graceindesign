CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'changes_requested');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('booked', 'done', 'no_show', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('active', 'completed', 'stopped');--> statement-breakpoint
CREATE TYPE "public"."hero_style" AS ENUM('classic', 'cinematic');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('pending', 'scheduled', 'paid', 'void');--> statement-breakpoint
CREATE TYPE "public"."lead_stage" AS ENUM('new', 'contacted', 'consultation_booked', 'proposal_sent', 'won', 'lost', 'nurture');--> statement-breakpoint
CREATE TYPE "public"."moderation_status" AS ENUM('pending', 'published', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('queued', 'sent', 'failed', 'logged');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('active', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('draft', 'sent', 'viewed', 'signed', 'declined');--> statement-breakpoint
CREATE TYPE "public"."social_post_status" AS ENUM('draft', 'scheduled', 'publishing', 'published', 'failed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'editor', 'sales', 'social');--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"response_note" text
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text,
	"weekdays" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"date" date,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"type" text DEFAULT 'discovery_15' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"tz" text DEFAULT 'America/New_York' NOT NULL,
	"status" "booking_status" DEFAULT 'booked' NOT NULL,
	"ics_sent_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"cancel_reason" text,
	"notes" text,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cc_countries" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "cc_countries_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "cc_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"time_label" text,
	"tz" text DEFAULT 'America/Jamaica' NOT NULL,
	"where_label" text NOT NULL,
	"format" text DEFAULT 'in_person' NOT NULL,
	"host" text NOT NULL,
	"url" text,
	"cost" text DEFAULT 'Free' NOT NULL,
	"description" text NOT NULL,
	"country" text DEFAULT 'Jamaica' NOT NULL,
	"status" "moderation_status" DEFAULT 'pending' NOT NULL,
	"submitted_by_name" text,
	"submitted_by_email" text,
	"reviewed_by" integer,
	"review_note" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cc_resources" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"country" text DEFAULT 'Jamaica' NOT NULL,
	"area" text,
	"type" text,
	"url" text,
	"description" text NOT NULL,
	"status" "moderation_status" DEFAULT 'pending' NOT NULL,
	"kind" text DEFAULT 'suggestion' NOT NULL,
	"submitted_by_name" text,
	"submitted_by_email" text,
	"reviewed_by" integer,
	"review_note" text,
	"published_at" timestamp with time zone,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cc_subscribers" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"segment" text NOT NULL,
	"location" text,
	"country" text,
	"consented_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unsubscribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cc_subscribers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "cron_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"summary" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"lead_id" integer,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"storage_key" text,
	"type" text DEFAULT 'other' NOT NULL,
	"size" integer,
	"visible_to_client" boolean DEFAULT true NOT NULL,
	"uploaded_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_sequence_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"sequence_id" integer NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"delay_hours" integer DEFAULT 24 NOT NULL,
	"channel" text DEFAULT 'email' NOT NULL,
	"subject" text,
	"body" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_sequences" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"trigger_path_id" text,
	"trigger_stage" "lead_stage",
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"type" text NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"placeholder" text,
	"required" boolean DEFAULT false NOT NULL,
	"scope" text DEFAULT 'base' NOT NULL,
	"path_id" text,
	"step" text DEFAULT 'project' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hubspot_sync" (
	"id" serial PRIMARY KEY NOT NULL,
	"object_type" text NOT NULL,
	"object_id" integer NOT NULL,
	"hubspot_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"last_synced_at" timestamp with time zone,
	CONSTRAINT "hubspot_sync_unique" UNIQUE("object_type","object_id")
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"purpose" text NOT NULL,
	"phase" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'not_connected' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integrations_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"label" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" "invoice_status" DEFAULT 'pending' NOT NULL,
	"due_at" date,
	"paid_at" timestamp with time zone,
	"stripe_invoice_id" text,
	"stripe_hosted_url" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"user_id" integer,
	"type" text NOT NULL,
	"body" text NOT NULL,
	"attachment_url" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"company" text,
	"contact_pref" text,
	"contact_time" text,
	"source_page" text DEFAULT 'general' NOT NULL,
	"source_label" text,
	"path_id" text,
	"utm" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stage" "lead_stage" DEFAULT 'new' NOT NULL,
	"owner_id" integer,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"consent_at" timestamp with time zone,
	"budget" text,
	"timeline" text,
	"address" text,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"follow_up_at" date,
	"external_id" text,
	"external_source" text,
	"archived" boolean DEFAULT false NOT NULL,
	"converted_project_id" integer,
	"hubspot_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "magic_link_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"redirect_to" text,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "magic_link_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"storage_key" text,
	"mime" text,
	"size" integer,
	"width" integer,
	"height" integer,
	"alt" text,
	"slot" text,
	"subject" text,
	"aspect" text,
	"used_on" text[] DEFAULT '{}'::text[] NOT NULL,
	"source" text DEFAULT 'upload' NOT NULL,
	"magnific_creation_id" text,
	"remote_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_slot_unique" UNIQUE("slot")
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"title" text NOT NULL,
	"due_at" date,
	"done_at" timestamp with time zone,
	"sort" integer DEFAULT 0 NOT NULL,
	"visible_to_client" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "newsletter_subscribers" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"source" text DEFAULT 'wellness' NOT NULL,
	"consented_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unsubscribed_at" timestamp with time zone,
	CONSTRAINT "newsletter_subscribers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"to_addr" text NOT NULL,
	"subject" text,
	"body_text" text,
	"body_html" text,
	"attachments" jsonb,
	"status" "outbox_status" DEFAULT 'queued' NOT NULL,
	"provider" text,
	"provider_id" text,
	"error" text,
	"related_type" text,
	"related_id" integer,
	"attempts" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"page_id" integer NOT NULL,
	"type" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"draft_content" jsonb,
	"visible" boolean DEFAULT true NOT NULL,
	"draft_visible" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"nav_label" text,
	"status" "content_status" DEFAULT 'published' NOT NULL,
	"hero_style" "hero_style" DEFAULT 'cinematic' NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"parent_key" text,
	"has_draft" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pages_slug_unique" UNIQUE("slug"),
	CONSTRAINT "pages_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "paths" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"short" text NOT NULL,
	"consult_type" text DEFAULT '15-min discovery call' NOT NULL,
	"page_keys" text[] DEFAULT '{}'::text[] NOT NULL,
	"color" text DEFAULT '#6cb6e6' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_access" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portal_access_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"excerpt" text,
	"body" text,
	"image_url" text,
	"category" text DEFAULT 'Healthy Home Resources' NOT NULL,
	"origin" text DEFAULT 'written' NOT NULL,
	"scope" text DEFAULT 'news' NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"source_url" text,
	"source_name" text,
	"guid" text,
	"rss_source_id" integer,
	"author_id" integer,
	"auto_shared" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posts_slug_unique" UNIQUE("slug"),
	CONSTRAINT "posts_guid_unique" UNIQUE("guid")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"etsy_url" text NOT NULL,
	"title" text NOT NULL,
	"price" text DEFAULT '$—' NOT NULL,
	"image_url" text,
	"category" text DEFAULT 'Uncategorized' NOT NULL,
	"tag" text,
	"reviews" text DEFAULT '(0)' NOT NULL,
	"rating" text DEFAULT '5.0' NOT NULL,
	"type" text DEFAULT 'Digital download' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"user_id" integer,
	"type" text NOT NULL,
	"body" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"type" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "project_fields_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "project_phases" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#1a2238' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_stages" (
	"id" serial PRIMARY KEY NOT NULL,
	"phase_id" integer NOT NULL,
	"name" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"automation" text DEFAULT 'none' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"lead_id" integer,
	"lead_name" text,
	"service_id" integer,
	"service_name" text,
	"name" text NOT NULL,
	"stage_id" integer,
	"owner_id" integer,
	"contract_value" numeric(12, 2),
	"signed_at" date,
	"target_date" date,
	"address" text,
	"scope" text,
	"next_milestone" text,
	"status" "project_status" DEFAULT 'active' NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"deposit_pct" integer DEFAULT 50 NOT NULL,
	"client_portal_enabled" boolean DEFAULT true NOT NULL,
	"closed_at" timestamp with time zone,
	"hubspot_deal_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer,
	"project_id" integer,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"amount" numeric(12, 2),
	"status" "proposal_status" DEFAULT 'draft' NOT NULL,
	"token" text NOT NULL,
	"recipient_email" text,
	"recipient_name" text,
	"sent_at" timestamp with time zone,
	"viewed_at" timestamp with time zone,
	"signed_at" timestamp with time zone,
	"signer_name" text,
	"signer_ip" text,
	"signature_data" text,
	"esign_provider" text,
	"esign_request_id" text,
	"pdf_url" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposals_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rss_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"scope" text DEFAULT 'news' NOT NULL,
	"country" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"item_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sequence_enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"sequence_id" integer NOT NULL,
	"lead_id" integer NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"next_send_at" timestamp with time zone,
	"status" "enrollment_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sequence_enrollments_unique" UNIQUE("sequence_id","lead_id")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"kicker" text NOT NULL,
	"parent_id" integer,
	"sort" integer DEFAULT 0 NOT NULL,
	"nav_group" text DEFAULT 'services' NOT NULL,
	"hero_style" "hero_style" DEFAULT 'cinematic' NOT NULL,
	"cine_lead" text,
	"cine_tail" text,
	"scenes_label" text,
	"scenes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"slide_seconds" integer DEFAULT 5 NOT NULL,
	"hero" text NOT NULL,
	"sub" text NOT NULL,
	"problem" text NOT NULL,
	"empathy" text NOT NULL,
	"authority" text NOT NULL,
	"plan" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"success" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"failure" text NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tiers" jsonb,
	"tiers_title" text,
	"tiers_sub" text,
	"steps" jsonb,
	"testimonial_quote" text,
	"testimonial_who" text,
	"img" text NOT NULL,
	"img2" text NOT NULL,
	"cta" text NOT NULL,
	"before_after" jsonb,
	"path_id" text,
	"status" "content_status" DEFAULT 'published' NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip" text,
	"user_agent" text,
	"source" text DEFAULT 'magic_link' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'Follow-up' NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"network" text NOT NULL,
	"display_name" text,
	"external_id" text,
	"access_token_enc" text,
	"refresh_token_enc" text,
	"token_expires_at" timestamp with time zone,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"followers" integer,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"connected_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_accounts_network_unique" UNIQUE("network")
);
--> statement-breakpoint
CREATE TABLE "social_feed_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"network" text NOT NULL,
	"external_id" text NOT NULL,
	"image_url" text,
	"permalink" text,
	"caption" text,
	"posted_at" timestamp with time zone,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_feed_items_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"body" text NOT NULL,
	"image_url" text,
	"link_url" text,
	"networks" text[] DEFAULT '{}'::text[] NOT NULL,
	"scheduled_at" timestamp with time zone,
	"status" "social_post_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"results" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"origin_post_id" integer,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sso_jtis" (
	"jti" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"title" text NOT NULL,
	"credentials" text,
	"quote" text,
	"bio" text,
	"bio2" text,
	"education" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"credential_list" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"photo_url" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "testimonials" (
	"id" serial PRIMARY KEY NOT NULL,
	"quote" text NOT NULL,
	"who" text NOT NULL,
	"where_label" text NOT NULL,
	"service_slug" text,
	"visible" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" DEFAULT 'editor' NOT NULL,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"avatar_url" text,
	"title" text,
	"cft_user_id" text,
	"last_login_at" timestamp with time zone,
	"invited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_cft_user_id_unique" UNIQUE("cft_user_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb,
	"attempts" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"response_status" integer,
	"next_retry_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"event_type" text NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"payload" jsonb,
	"error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "webhook_events_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "webhook_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"events" text[] DEFAULT '{}'::text[] NOT NULL,
	"secret_enc" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cc_events" ADD CONSTRAINT "cc_events_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cc_resources" ADD CONSTRAINT "cc_resources_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sequence_steps" ADD CONSTRAINT "email_sequence_steps_sequence_id_email_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."email_sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sequences" ADD CONSTRAINT "email_sequences_trigger_path_id_paths_id_fk" FOREIGN KEY ("trigger_path_id") REFERENCES "public"."paths"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_path_id_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."paths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activity" ADD CONSTRAINT "lead_activity_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activity" ADD CONSTRAINT "lead_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_path_id_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."paths"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_blocks" ADD CONSTRAINT "page_blocks_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_access" ADD CONSTRAINT "portal_access_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_rss_source_id_rss_sources_id_fk" FOREIGN KEY ("rss_source_id") REFERENCES "public"."rss_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_activity" ADD CONSTRAINT "project_activity_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_activity" ADD CONSTRAINT "project_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_stages" ADD CONSTRAINT "project_stages_phase_id_project_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."project_phases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_stage_id_project_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."project_stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_sequence_id_email_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."email_sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_parent_id_services_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_path_id_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."paths"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_origin_post_id_posts_id_fk" FOREIGN KEY ("origin_post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_subscription_id_webhook_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."webhook_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "bookings_start_idx" ON "bookings" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "form_fields_scope_idx" ON "form_fields" USING btree ("scope","path_id");--> statement-breakpoint
CREATE INDEX "lead_activity_lead_idx" ON "lead_activity" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "leads_stage_idx" ON "leads" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "leads_email_idx" ON "leads" USING btree ("email");--> statement-breakpoint
CREATE INDEX "leads_external_idx" ON "leads" USING btree ("external_source","external_id");--> statement-breakpoint
CREATE INDEX "outbox_status_idx" ON "outbox" USING btree ("status");--> statement-breakpoint
CREATE INDEX "page_blocks_page_idx" ON "page_blocks" USING btree ("page_id","sort");--> statement-breakpoint
CREATE INDEX "posts_status_idx" ON "posts" USING btree ("status","scope","published_at");--> statement-breakpoint
CREATE INDEX "projects_stage_idx" ON "projects" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "social_posts_sched_idx" ON "social_posts" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_status_idx" ON "webhook_deliveries" USING btree ("status","next_retry_at");