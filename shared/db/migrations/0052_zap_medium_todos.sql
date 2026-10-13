CREATE TABLE "zap"."user_library_entries" (
	"user_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"sort_key" integer DEFAULT 0 NOT NULL,
	"source_sync_run_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_library_entries_user_id_media_asset_id_pk" PRIMARY KEY("user_id","media_asset_id")
);
--> statement-breakpoint
CREATE TABLE "zap"."play_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid,
	"media_asset_id" uuid NOT NULL,
	"played_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zap"."saved_queues" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"source_session_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zap"."saved_queue_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"saved_queue_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "zap"."user_library_entries" ADD CONSTRAINT "user_library_entries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."user_library_entries" ADD CONSTRAINT "user_library_entries_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "zap"."media_assets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."user_library_entries" ADD CONSTRAINT "user_library_entries_source_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("source_sync_run_id") REFERENCES "zap"."sync_runs"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."play_events" ADD CONSTRAINT "play_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."play_events" ADD CONSTRAINT "play_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "zap"."sessions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."play_events" ADD CONSTRAINT "play_events_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "zap"."media_assets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."saved_queues" ADD CONSTRAINT "saved_queues_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."saved_queues" ADD CONSTRAINT "saved_queues_source_session_id_sessions_id_fk" FOREIGN KEY ("source_session_id") REFERENCES "zap"."sessions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."saved_queue_items" ADD CONSTRAINT "saved_queue_items_saved_queue_id_saved_queues_id_fk" FOREIGN KEY ("saved_queue_id") REFERENCES "zap"."saved_queues"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."saved_queue_items" ADD CONSTRAINT "saved_queue_items_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "zap"."media_assets"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "user_library_entries_user_sort_idx" ON "zap"."user_library_entries" USING btree ("user_id","sort_key");
--> statement-breakpoint
CREATE INDEX "play_events_user_id_played_at_idx" ON "zap"."play_events" USING btree ("user_id","played_at");
--> statement-breakpoint
CREATE INDEX "play_events_media_asset_id_idx" ON "zap"."play_events" USING btree ("media_asset_id");
--> statement-breakpoint
CREATE INDEX "saved_queues_user_id_idx" ON "zap"."saved_queues" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "saved_queue_items_queue_position_unique" ON "zap"."saved_queue_items" USING btree ("saved_queue_id","position");
--> statement-breakpoint
CREATE INDEX "saved_queue_items_saved_queue_id_idx" ON "zap"."saved_queue_items" USING btree ("saved_queue_id");
