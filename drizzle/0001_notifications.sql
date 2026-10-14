CREATE TABLE "cft_launch_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" integer,
	"email" text NOT NULL,
	"target" text,
	"purpose" text,
	"related_type" text,
	"related_id" integer,
	"expires_at" timestamp with time zone NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cft_launch_links_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "from_addr" text;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "reply_to" text;--> statement-breakpoint
ALTER TABLE "cft_launch_links" ADD CONSTRAINT "cft_launch_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cft_launch_links_exp_idx" ON "cft_launch_links" USING btree ("expires_at");