-- Persistent background catalogue import jobs (Add song / Connections YouTube).
CREATE TYPE "zap"."import_job_kind" AS ENUM('url', 'youtube_playlist', 'upload');
--> statement-breakpoint
CREATE TYPE "zap"."import_job_status" AS ENUM('queued', 'running', 'completed', 'failed');
--> statement-breakpoint
CREATE TYPE "zap"."import_job_item_status" AS ENUM('pending', 'running', 'imported', 'reused', 'skipped', 'unavailable', 'failed');
--> statement-breakpoint
CREATE TABLE "zap"."import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "zap"."import_job_kind" NOT NULL,
	"status" "zap"."import_job_status" DEFAULT 'queued' NOT NULL,
	"label" text NOT NULL,
	"source_json" text,
	"total" integer DEFAULT 0 NOT NULL,
	"done" integer DEFAULT 0 NOT NULL,
	"imported_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"unavailable_count" integer DEFAULT 0 NOT NULL,
	"current_title" text,
	"error_message" text,
	"sync_run_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "zap"."import_job_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"job_id" uuid NOT NULL,
	"identity_key" text NOT NULL,
	"title" text,
	"status" "zap"."import_job_item_status" DEFAULT 'pending' NOT NULL,
	"reason" text,
	"source_url" text,
	"media_asset_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "zap"."import_jobs" ADD CONSTRAINT "import_jobs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."import_jobs" ADD CONSTRAINT "import_jobs_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "zap"."sync_runs"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."import_job_items" ADD CONSTRAINT "import_job_items_job_id_import_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "zap"."import_jobs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."import_job_items" ADD CONSTRAINT "import_job_items_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "zap"."media_assets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "import_jobs_user_status_idx" ON "zap"."import_jobs" USING btree ("user_id","status");
--> statement-breakpoint
CREATE INDEX "import_jobs_user_created_idx" ON "zap"."import_jobs" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "import_job_items_job_id_idx" ON "zap"."import_job_items" USING btree ("job_id");
--> statement-breakpoint
CREATE INDEX "import_job_items_job_status_idx" ON "zap"."import_job_items" USING btree ("job_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX "import_job_items_job_identity_unique" ON "zap"."import_job_items" USING btree ("job_id","identity_key");
