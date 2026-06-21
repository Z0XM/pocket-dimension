CREATE SCHEMA "rhymes";
--> statement-breakpoint
CREATE TYPE "rhymes"."rhymes_content_type" AS ENUM('poem', 'article', 'song', 'diary');--> statement-breakpoint
CREATE TYPE "rhymes"."rhymes_piece_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "rhymes"."rhymes_piece_visibility" AS ENUM('public', 'hidden');--> statement-breakpoint
CREATE TYPE "rhymes"."rhymes_reader_mode" AS ENUM('continuous', 'paged');--> statement-breakpoint
CREATE TABLE "rhymes"."pieces" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"slug" text NOT NULL,
	"content_type" "rhymes"."rhymes_content_type" DEFAULT 'poem' NOT NULL,
	"status" "rhymes"."rhymes_piece_status" DEFAULT 'draft' NOT NULL,
	"visibility" "rhymes"."rhymes_piece_visibility" DEFAULT 'hidden' NOT NULL,
	"title_text" text NOT NULL,
	"body_plain" text NOT NULL,
	"default_reader_mode" "rhymes"."rhymes_reader_mode" DEFAULT 'continuous' NOT NULL,
	"author_id" uuid NOT NULL,
	CONSTRAINT "pieces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "rhymes"."pieces" ADD CONSTRAINT "pieces_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rhymes"."pieces" ADD CONSTRAINT "pieces_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rhymes"."pieces" ADD CONSTRAINT "pieces_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rhymes_pieces_author_id_idx" ON "rhymes"."pieces" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "rhymes_pieces_status_visibility_idx" ON "rhymes"."pieces" USING btree ("status","visibility");
