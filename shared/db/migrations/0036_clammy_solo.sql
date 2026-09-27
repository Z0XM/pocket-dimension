CREATE TABLE "howwasyourday"."legacy_recap_profile" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"year" integer DEFAULT 2025 NOT NULL,
	"slug" text NOT NULL,
	"legacy_user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"accent_color" text DEFAULT '#214247' NOT NULL,
	"rank" integer NOT NULL,
	"days_filled" integer DEFAULT 0 NOT NULL,
	"drawings_count" integer DEFAULT 0 NOT NULL,
	"months_filled" integer DEFAULT 0 NOT NULL,
	"avg_score" numeric(6, 2),
	"first_date" text,
	"last_date" text,
	"email" text NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "legacy_recap_profile_slug_year" UNIQUE("slug","year"),
	CONSTRAINT "legacy_recap_profile_legacy_user_year" UNIQUE("legacy_user_id","year")
);
--> statement-breakpoint
CREATE TABLE "howwasyourday"."legacy_recap_drawing" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"profile_id" uuid NOT NULL,
	"day_int" integer NOT NULL,
	"png" "bytea" NOT NULL,
	"content_type" text DEFAULT 'image/png' NOT NULL,
	CONSTRAINT "legacy_recap_drawing_profile_day" UNIQUE("profile_id","day_int")
);
--> statement-breakpoint
CREATE TABLE "howwasyourday"."legacy_recap_otp" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"profile_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "howwasyourday"."legacy_recap_link" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"profile_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"linked_at" timestamp NOT NULL,
	CONSTRAINT "legacy_recap_link_profile" UNIQUE("profile_id")
);
--> statement-breakpoint
ALTER TABLE "howwasyourday"."legacy_recap_drawing" ADD CONSTRAINT "legacy_recap_drawing_profile_id_legacy_recap_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "howwasyourday"."legacy_recap_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "howwasyourday"."legacy_recap_link" ADD CONSTRAINT "legacy_recap_link_profile_id_legacy_recap_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "howwasyourday"."legacy_recap_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "howwasyourday"."legacy_recap_link" ADD CONSTRAINT "legacy_recap_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "howwasyourday"."legacy_recap_otp" ADD CONSTRAINT "legacy_recap_otp_profile_id_legacy_recap_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "howwasyourday"."legacy_recap_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "legacy_recap_drawing_profile_idx" ON "howwasyourday"."legacy_recap_drawing" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "legacy_recap_link_user_idx" ON "howwasyourday"."legacy_recap_link" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "legacy_recap_otp_profile_idx" ON "howwasyourday"."legacy_recap_otp" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "legacy_recap_profile_year_rank_idx" ON "howwasyourday"."legacy_recap_profile" USING btree ("year","rank");
