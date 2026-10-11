CREATE SCHEMA IF NOT EXISTS "zap";
--> statement-breakpoint
CREATE TYPE "zap"."media_asset_status" AS ENUM('pending', 'ready', 'failed');
--> statement-breakpoint
CREATE TYPE "zap"."media_source_type" AS ENUM('upload', 'youtube', 'url', 'other');
--> statement-breakpoint
CREATE TYPE "zap"."tag_kind" AS ENUM('system', 'custom');
--> statement-breakpoint
CREATE TABLE "zap"."media_assets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"identity_key" text NOT NULL,
	"source_type" "zap"."media_source_type" NOT NULL,
	"status" "zap"."media_asset_status" DEFAULT 'pending' NOT NULL,
	"storage_key" text,
	"title" text NOT NULL,
	"artists" text,
	"duration_ms" integer,
	"codec" text,
	"external_url" text,
	"error_message" text,
	"added_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zap"."tags" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"kind" "zap"."tag_kind" NOT NULL,
	"owner_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zap"."media_asset_tags" (
	"user_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "media_asset_tags_user_id_media_asset_id_tag_id_pk" PRIMARY KEY("user_id","media_asset_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "zap"."media_assets" ADD CONSTRAINT "media_assets_added_by_user_id_user_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."tags" ADD CONSTRAINT "tags_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."media_asset_tags" ADD CONSTRAINT "media_asset_tags_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."media_asset_tags" ADD CONSTRAINT "media_asset_tags_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "zap"."media_assets"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."media_asset_tags" ADD CONSTRAINT "media_asset_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "zap"."tags"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_identity_key_unique" ON "zap"."media_assets" USING btree ("identity_key");
--> statement-breakpoint
CREATE INDEX "media_assets_status_idx" ON "zap"."media_assets" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "media_assets_added_by_user_id_idx" ON "zap"."media_assets" USING btree ("added_by_user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "tags_system_slug_unique" ON "zap"."tags" USING btree ("slug") WHERE "zap"."tags"."kind" = 'system';
--> statement-breakpoint
CREATE UNIQUE INDEX "tags_custom_owner_slug_unique" ON "zap"."tags" USING btree ("owner_user_id","slug") WHERE "zap"."tags"."kind" = 'custom';
--> statement-breakpoint
CREATE INDEX "tags_owner_user_id_idx" ON "zap"."tags" USING btree ("owner_user_id");
--> statement-breakpoint
CREATE INDEX "media_asset_tags_user_id_idx" ON "zap"."media_asset_tags" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "media_asset_tags_media_asset_id_idx" ON "zap"."media_asset_tags" USING btree ("media_asset_id");
--> statement-breakpoint
CREATE INDEX "media_asset_tags_tag_id_idx" ON "zap"."media_asset_tags" USING btree ("tag_id");
--> statement-breakpoint
CREATE INDEX "media_asset_tags_user_asset_idx" ON "zap"."media_asset_tags" USING btree ("user_id","media_asset_id");
--> statement-breakpoint
INSERT INTO "zap"."tags" ("id", "name", "slug", "kind", "owner_user_id", "created_at")
VALUES
	(uuidv7(), 'slow', 'slow', 'system', NULL, now()),
	(uuidv7(), 'ignite', 'ignite', 'system', NULL, now()),
	(uuidv7(), 'blast', 'blast', 'system', NULL, now()),
	(uuidv7(), 'love', 'love', 'system', NULL, now()),
	(uuidv7(), 'sad', 'sad', 'system', NULL, now()),
	(uuidv7(), 'happy', 'happy', 'system', NULL, now()),
	(uuidv7(), 'upbeat', 'upbeat', 'system', NULL, now()),
	(uuidv7(), 'rap', 'rap', 'system', NULL, now());
