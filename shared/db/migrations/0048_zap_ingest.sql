CREATE TYPE "zap"."fetch_job_status" AS ENUM('pending', 'running', 'ready', 'failed');
--> statement-breakpoint
CREATE TYPE "zap"."sync_run_status" AS ENUM('pending', 'running', 'completed', 'failed');
--> statement-breakpoint
CREATE TABLE "zap"."fetch_jobs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"identity_key" text NOT NULL,
	"status" "zap"."fetch_job_status" DEFAULT 'pending' NOT NULL,
	"media_asset_id" uuid,
	"source_url" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zap"."sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_url" text NOT NULL,
	"status" "zap"."sync_run_status" DEFAULT 'pending' NOT NULL,
	"imported_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"summary_json" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "zap"."fetch_jobs" ADD CONSTRAINT "fetch_jobs_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "zap"."media_assets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."sync_runs" ADD CONSTRAINT "sync_runs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "fetch_jobs_identity_key_unique" ON "zap"."fetch_jobs" USING btree ("identity_key");
--> statement-breakpoint
CREATE INDEX "fetch_jobs_status_idx" ON "zap"."fetch_jobs" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "sync_runs_user_id_idx" ON "zap"."sync_runs" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "sync_runs_status_idx" ON "zap"."sync_runs" USING btree ("status");
