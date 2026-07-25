CREATE TYPE "zeo"."listening_playback_state" AS ENUM('idle', 'playing', 'paused', 'error');--> statement-breakpoint
CREATE TYPE "zeo"."listening_queue_source" AS ENUM('library_yt', 'library_ytm', 'search', 'url');--> statement-breakpoint
CREATE TABLE "zeo"."youtube_account_links" (
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
CREATE TABLE "zeo"."listening_sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"room_id" uuid NOT NULL,
	"linker_user_id" uuid NOT NULL,
	"dj_user_id" uuid NOT NULL,
	"playback_state" "zeo"."listening_playback_state" DEFAULT 'idle' NOT NULL,
	"current_queue_item_id" uuid,
	"position_ms" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"bot_identity" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "zeo"."listening_queue_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"session_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"video_id" text NOT NULL,
	"title" text NOT NULL,
	"channel_title" text,
	"thumbnail_url" text,
	"duration_ms" integer,
	"source" "zeo"."listening_queue_source" NOT NULL,
	"added_by_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "listening_queue_items_session_position_unique" UNIQUE("session_id","position")
);
--> statement-breakpoint
ALTER TABLE "zeo"."youtube_account_links" ADD CONSTRAINT "youtube_account_links_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."listening_sessions" ADD CONSTRAINT "listening_sessions_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "zeo"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."listening_sessions" ADD CONSTRAINT "listening_sessions_linker_user_id_user_id_fk" FOREIGN KEY ("linker_user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."listening_sessions" ADD CONSTRAINT "listening_sessions_dj_user_id_user_id_fk" FOREIGN KEY ("dj_user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."listening_queue_items" ADD CONSTRAINT "listening_queue_items_session_id_listening_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "zeo"."listening_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."listening_queue_items" ADD CONSTRAINT "listening_queue_items_added_by_user_id_user_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listening_sessions_room_id_idx" ON "zeo"."listening_sessions" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "listening_sessions_linker_user_id_idx" ON "zeo"."listening_sessions" USING btree ("linker_user_id");--> statement-breakpoint
CREATE INDEX "listening_sessions_dj_user_id_idx" ON "zeo"."listening_sessions" USING btree ("dj_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "listening_sessions_one_active_per_room" ON "zeo"."listening_sessions" USING btree ("room_id") WHERE "zeo"."listening_sessions"."ended_at" IS NULL;--> statement-breakpoint
CREATE INDEX "listening_queue_items_session_id_idx" ON "zeo"."listening_queue_items" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "listening_queue_items_added_by_user_id_idx" ON "zeo"."listening_queue_items" USING btree ("added_by_user_id");
