CREATE TYPE "watchlist"."connector_run_trigger" AS ENUM('cron', 'manual');--> statement-breakpoint
CREATE TYPE "watchlist"."connector_run_status" AS ENUM('running', 'success', 'failure', 'partial');--> statement-breakpoint
CREATE TABLE "watchlist"."connector_settings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"connector_id" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"cron_expression" text,
	"page_size" integer,
	"status_filter" text,
	"destination_username" text,
	"catalog_actor_username" text,
	CONSTRAINT "connector_settings_connector_id_unique" UNIQUE("connector_id")
);
--> statement-breakpoint
CREATE TABLE "watchlist"."connector_runs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"connector_id" text NOT NULL,
	"trigger" "watchlist"."connector_run_trigger" NOT NULL,
	"status" "watchlist"."connector_run_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp NOT NULL,
	"finished_at" timestamp,
	"duration_ms" integer,
	"fetched" integer DEFAULT 0,
	"catalog_imported" integer DEFAULT 0,
	"catalog_updated" integer DEFAULT 0,
	"catalog_skipped" integer DEFAULT 0,
	"ratings_imported" integer DEFAULT 0,
	"ratings_updated" integer DEFAULT 0,
	"ratings_skipped" integer DEFAULT 0,
	"error_count" integer DEFAULT 0,
	"error_snippet" text,
	"summary" json,
	"triggered_by_user_id" uuid
);
--> statement-breakpoint
ALTER TABLE "watchlist"."connector_runs" ADD CONSTRAINT "connector_runs_triggered_by_user_id_user_id_fk" FOREIGN KEY ("triggered_by_user_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "connector_runs_connector_id_started_at_idx" ON "watchlist"."connector_runs" USING btree ("connector_id","started_at");
