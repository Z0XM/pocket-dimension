CREATE TABLE "howwasyourday"."legacy_recap_ai_analysis" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"profile_id" uuid NOT NULL,
	"year" integer DEFAULT 2025 NOT NULL,
	"model_label" text DEFAULT 'cursor-subagent' NOT NULL,
	"prompt_version" text DEFAULT 'v1' NOT NULL,
	"input_fingerprint" text NOT NULL,
	"analysis" jsonb NOT NULL,
	"status" text DEFAULT 'ready' NOT NULL,
	"error" text,
	CONSTRAINT "legacy_recap_ai_analysis_profile" UNIQUE("profile_id")
);
--> statement-breakpoint
ALTER TABLE "howwasyourday"."legacy_recap_ai_analysis" ADD CONSTRAINT "legacy_recap_ai_analysis_profile_id_legacy_recap_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "howwasyourday"."legacy_recap_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "legacy_recap_ai_analysis_year_idx" ON "howwasyourday"."legacy_recap_ai_analysis" USING btree ("year");