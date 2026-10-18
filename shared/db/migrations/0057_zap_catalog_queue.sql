CREATE TYPE "zap"."catalog_queue_status" AS ENUM('active', 'ended');
--> statement-breakpoint
CREATE TABLE "zap"."catalog_queues" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "zap"."catalog_queue_status" DEFAULT 'active' NOT NULL,
	"playback_state" "zap"."session_playback_state" DEFAULT 'idle' NOT NULL,
	"current_item_id" uuid,
	"position_ms" integer DEFAULT 0 NOT NULL,
	"position_updated_at" timestamp DEFAULT now() NOT NULL,
	"playback_generation" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "zap"."catalog_queue_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"queue_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"source" text DEFAULT 'last' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zap"."catalog_devices" (
	"user_id" uuid NOT NULL,
	"device_id" text NOT NULL,
	"label" text NOT NULL,
	"output_enabled" boolean DEFAULT true NOT NULL,
	"volume" integer DEFAULT 100 NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_devices_user_id_device_id_pk" PRIMARY KEY("user_id","device_id")
);
--> statement-breakpoint
ALTER TABLE "zap"."catalog_queues" ADD CONSTRAINT "catalog_queues_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."catalog_queue_items" ADD CONSTRAINT "catalog_queue_items_queue_id_catalog_queues_id_fk" FOREIGN KEY ("queue_id") REFERENCES "zap"."catalog_queues"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."catalog_queue_items" ADD CONSTRAINT "catalog_queue_items_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "zap"."media_assets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."catalog_devices" ADD CONSTRAINT "catalog_devices_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_queues_one_active_per_user" ON "zap"."catalog_queues" USING btree ("user_id") WHERE "zap"."catalog_queues"."status" = 'active';
--> statement-breakpoint
CREATE INDEX "catalog_queues_user_updated_idx" ON "zap"."catalog_queues" USING btree ("user_id","updated_at");
--> statement-breakpoint
CREATE INDEX "catalog_queue_items_queue_position_idx" ON "zap"."catalog_queue_items" USING btree ("queue_id","position");
--> statement-breakpoint
CREATE INDEX "catalog_queue_items_media_asset_id_idx" ON "zap"."catalog_queue_items" USING btree ("media_asset_id");
--> statement-breakpoint
CREATE INDEX "catalog_devices_user_seen_idx" ON "zap"."catalog_devices" USING btree ("user_id","last_seen_at");
