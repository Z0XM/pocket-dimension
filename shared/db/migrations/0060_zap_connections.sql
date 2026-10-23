-- Zap Connections: YouTube playlist auto-sync prefs + connection activity log.
CREATE TYPE "zap"."connection_provider" AS ENUM('discord', 'spotify', 'youtube');
--> statement-breakpoint
CREATE TABLE "zap"."youtube_playlist_prefs" (
	"user_id" uuid NOT NULL,
	"youtube_playlist_id" text NOT NULL,
	"title" text,
	"auto_sync" boolean DEFAULT false NOT NULL,
	"last_synced_at" timestamp,
	"last_sync_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "youtube_playlist_prefs_user_id_youtube_playlist_id_pk" PRIMARY KEY("user_id","youtube_playlist_id")
);
--> statement-breakpoint
CREATE TABLE "zap"."connection_activity" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "zap"."connection_provider" NOT NULL,
	"kind" text NOT NULL,
	"summary" text NOT NULL,
	"meta_json" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "zap"."youtube_playlist_prefs" ADD CONSTRAINT "youtube_playlist_prefs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."connection_activity" ADD CONSTRAINT "connection_activity_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "youtube_playlist_prefs_user_autosync_idx" ON "zap"."youtube_playlist_prefs" USING btree ("user_id","auto_sync");
--> statement-breakpoint
CREATE INDEX "connection_activity_user_provider_idx" ON "zap"."connection_activity" USING btree ("user_id","provider","created_at");
