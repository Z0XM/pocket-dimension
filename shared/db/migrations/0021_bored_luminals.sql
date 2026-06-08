CREATE SCHEMA "meviayou";
--> statement-breakpoint
CREATE TYPE "meviayou"."form_classification" AS ENUM('positive', 'negative', 'general');--> statement-breakpoint
CREATE TYPE "meviayou"."form_status" AS ENUM('active', 'closed');--> statement-breakpoint
CREATE TABLE "meviayou"."forms" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"user_id" uuid NOT NULL,
	"question" text NOT NULL,
	"classification" "meviayou"."form_classification" NOT NULL,
	"status" "meviayou"."form_status" DEFAULT 'active' NOT NULL,
	"public_slug" text NOT NULL,
	"closes_at" timestamp,
	CONSTRAINT "forms_public_slug_unique" UNIQUE("public_slug")
);
--> statement-breakpoint
CREATE TABLE "meviayou"."answers" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"form_id" uuid NOT NULL,
	"primary_answer" text NOT NULL,
	"expand_detail" text,
	"notes" text,
	"respondent_name" text,
	"is_anonymous" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meviayou"."forms" ADD CONSTRAINT "forms_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meviayou"."answers" ADD CONSTRAINT "answers_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "meviayou"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "forms_user_id_idx" ON "meviayou"."forms" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "answers_form_id_idx" ON "meviayou"."answers" USING btree ("form_id");
