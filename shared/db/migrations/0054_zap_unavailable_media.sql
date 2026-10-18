ALTER TYPE "zap"."media_asset_status" ADD VALUE IF NOT EXISTS 'unavailable';
--> statement-breakpoint
ALTER TABLE "zap"."sync_runs" ADD COLUMN "unavailable_count" integer DEFAULT 0 NOT NULL;
