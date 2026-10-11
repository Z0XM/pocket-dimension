CREATE TABLE "zap"."youtube_account_links" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"google_sub" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"access_token_enc" text NOT NULL,
	"access_expires_at" timestamp NOT NULL,
	"scopes" text[] NOT NULL,
	"linked_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "zap"."youtube_account_links" ADD CONSTRAINT "youtube_account_links_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
