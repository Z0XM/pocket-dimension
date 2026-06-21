CREATE TYPE "rhymes"."rhymes_source_mode" AS ENUM('plain', 'markdown', 'html');--> statement-breakpoint
CREATE TYPE "rhymes"."rhymes_display_title_mode" AS ENUM('text', 'art');--> statement-breakpoint
CREATE TYPE "rhymes"."rhymes_membership_role" AS ENUM('owner', 'admin', 'editor', 'contributor', 'viewer');--> statement-breakpoint
CREATE TYPE "rhymes"."rhymes_asset_kind" AS ENUM('title_art');--> statement-breakpoint
CREATE TYPE "rhymes"."rhymes_piece_permission_level" AS ENUM('edit');--> statement-breakpoint
ALTER TABLE "rhymes"."pieces" ADD COLUMN "source_mode" "rhymes"."rhymes_source_mode" DEFAULT 'plain' NOT NULL;--> statement-breakpoint
ALTER TABLE "rhymes"."pieces" ADD COLUMN "body_document" jsonb;--> statement-breakpoint
ALTER TABLE "rhymes"."pieces" ADD COLUMN "body_render_html" text;--> statement-breakpoint
ALTER TABLE "rhymes"."pieces" ADD COLUMN "title_rich_json" jsonb;--> statement-breakpoint
ALTER TABLE "rhymes"."pieces" ADD COLUMN "display_title_mode" "rhymes"."rhymes_display_title_mode" DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE "rhymes"."pieces" ADD COLUMN "title_art_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "rhymes"."pieces" ADD COLUMN "creator_rating" integer;--> statement-breakpoint
ALTER TABLE "rhymes"."pieces" ADD COLUMN "reader_average_rating" numeric(4, 2);--> statement-breakpoint
ALTER TABLE "rhymes"."pieces" ADD COLUMN "reader_rating_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "rhymes"."pieces" ADD COLUMN "published_at" timestamp;--> statement-breakpoint
CREATE TABLE "rhymes"."assets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"piece_id" uuid NOT NULL,
	"kind" "rhymes"."rhymes_asset_kind" NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rhymes"."piece_ratings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"piece_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	CONSTRAINT "rhymes_piece_ratings_piece_user_unique" UNIQUE("piece_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "rhymes"."memberships" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"user_id" uuid NOT NULL,
	"role" "rhymes"."rhymes_membership_role" DEFAULT 'viewer' NOT NULL,
	CONSTRAINT "rhymes_memberships_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "rhymes"."piece_permissions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"piece_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"permission_level" "rhymes"."rhymes_piece_permission_level" DEFAULT 'edit' NOT NULL,
	CONSTRAINT "rhymes_piece_permissions_piece_user_unique" UNIQUE("piece_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "rhymes"."piece_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"piece_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"payload_json" jsonb
);
--> statement-breakpoint
ALTER TABLE "rhymes"."pieces" ADD CONSTRAINT "pieces_title_art_asset_id_assets_id_fk" FOREIGN KEY ("title_art_asset_id") REFERENCES "rhymes"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rhymes"."assets" ADD CONSTRAINT "assets_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rhymes"."assets" ADD CONSTRAINT "assets_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rhymes"."assets" ADD CONSTRAINT "assets_piece_id_pieces_id_fk" FOREIGN KEY ("piece_id") REFERENCES "rhymes"."pieces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rhymes"."piece_ratings" ADD CONSTRAINT "piece_ratings_piece_id_pieces_id_fk" FOREIGN KEY ("piece_id") REFERENCES "rhymes"."pieces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rhymes"."piece_ratings" ADD CONSTRAINT "piece_ratings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rhymes"."memberships" ADD CONSTRAINT "memberships_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rhymes"."memberships" ADD CONSTRAINT "memberships_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rhymes"."memberships" ADD CONSTRAINT "memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rhymes"."piece_permissions" ADD CONSTRAINT "piece_permissions_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rhymes"."piece_permissions" ADD CONSTRAINT "piece_permissions_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rhymes"."piece_permissions" ADD CONSTRAINT "piece_permissions_piece_id_pieces_id_fk" FOREIGN KEY ("piece_id") REFERENCES "rhymes"."pieces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rhymes"."piece_permissions" ADD CONSTRAINT "piece_permissions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rhymes"."piece_events" ADD CONSTRAINT "piece_events_piece_id_pieces_id_fk" FOREIGN KEY ("piece_id") REFERENCES "rhymes"."pieces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rhymes"."piece_events" ADD CONSTRAINT "piece_events_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rhymes_assets_piece_id_idx" ON "rhymes"."assets" USING btree ("piece_id");--> statement-breakpoint
CREATE INDEX "rhymes_piece_ratings_piece_id_idx" ON "rhymes"."piece_ratings" USING btree ("piece_id");--> statement-breakpoint
CREATE INDEX "rhymes_piece_permissions_user_id_idx" ON "rhymes"."piece_permissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rhymes_piece_events_piece_id_idx" ON "rhymes"."piece_events" USING btree ("piece_id");
