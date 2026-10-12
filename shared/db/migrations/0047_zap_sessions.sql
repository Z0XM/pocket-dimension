CREATE TYPE "zap"."session_status" AS ENUM('live', 'ended');
--> statement-breakpoint
CREATE TYPE "zap"."session_playback_state" AS ENUM('idle', 'playing', 'paused');
--> statement-breakpoint
CREATE TYPE "zap"."session_member_role" AS ENUM('host', 'guest');
--> statement-breakpoint
CREATE TABLE "zap"."sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"host_user_id" uuid NOT NULL,
	"join_code" text NOT NULL,
	"status" "zap"."session_status" DEFAULT 'live' NOT NULL,
	"playback_state" "zap"."session_playback_state" DEFAULT 'idle' NOT NULL,
	"current_queue_item_id" uuid,
	"position_ms" integer DEFAULT 0 NOT NULL,
	"position_updated_at" timestamp DEFAULT now() NOT NULL,
	"playback_generation" integer DEFAULT 0 NOT NULL,
	"guests_can_add" boolean DEFAULT false NOT NULL,
	"guests_can_control" boolean DEFAULT false NOT NULL,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "zap"."session_members" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "zap"."session_member_role" NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"left_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "zap"."queue_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"session_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"added_by_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "zap"."sessions" ADD CONSTRAINT "sessions_host_user_id_user_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."session_members" ADD CONSTRAINT "session_members_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "zap"."sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."session_members" ADD CONSTRAINT "session_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."queue_items" ADD CONSTRAINT "queue_items_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "zap"."sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."queue_items" ADD CONSTRAINT "queue_items_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "zap"."media_assets"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."queue_items" ADD CONSTRAINT "queue_items_added_by_user_id_user_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_join_code_unique" ON "zap"."sessions" USING btree ("join_code");
--> statement-breakpoint
CREATE INDEX "sessions_host_user_id_idx" ON "zap"."sessions" USING btree ("host_user_id");
--> statement-breakpoint
CREATE INDEX "sessions_status_idx" ON "zap"."sessions" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "sessions_last_activity_at_idx" ON "zap"."sessions" USING btree ("last_activity_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "session_members_active_unique" ON "zap"."session_members" USING btree ("session_id","user_id") WHERE "left_at" IS NULL;
--> statement-breakpoint
CREATE INDEX "session_members_session_id_idx" ON "zap"."session_members" USING btree ("session_id");
--> statement-breakpoint
CREATE INDEX "session_members_user_id_idx" ON "zap"."session_members" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "queue_items_session_position_unique" ON "zap"."queue_items" USING btree ("session_id","position");
--> statement-breakpoint
CREATE INDEX "queue_items_session_id_idx" ON "zap"."queue_items" USING btree ("session_id");
--> statement-breakpoint
CREATE INDEX "queue_items_media_asset_id_idx" ON "zap"."queue_items" USING btree ("media_asset_id");
--> statement-breakpoint
CREATE INDEX "queue_items_added_by_user_id_idx" ON "zap"."queue_items" USING btree ("added_by_user_id");
