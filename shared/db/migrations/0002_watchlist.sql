CREATE SCHEMA "watchlist";
--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'contributor', 'admin');--> statement-breakpoint
CREATE TYPE "watchlist"."watch_item_type" AS ENUM('movie', 'series', 'shorts');--> statement-breakpoint
CREATE TYPE "watchlist"."watch_recommendations" AS ENUM('must_watch', 'go_for_it', 'one_time_watch', 'skip_it');--> statement-breakpoint
CREATE TABLE "watchlist"."watch_item_languages" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by_id" text NOT NULL,
	"updated_by_id" text,
	"watch_item_id" text NOT NULL,
	"watch_language_id" text NOT NULL,
	CONSTRAINT "watch_item_languages_watch_item_id_watch_language_id_unique" UNIQUE("watch_item_id","watch_language_id")
);
--> statement-breakpoint
CREATE TABLE "watchlist"."watch_item_ratings" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by_id" text NOT NULL,
	"updated_by_id" text,
	"watch_item_id" text NOT NULL,
	"rating" integer,
	"infinity" boolean DEFAULT false,
	"shitty" boolean DEFAULT false,
	"recommendation" "watchlist"."watch_recommendations" DEFAULT 'go_for_it',
	"review" text DEFAULT '',
	CONSTRAINT "watch_item_ratings_watch_item_id_rating_unique" UNIQUE("watch_item_id","rating")
);
--> statement-breakpoint
CREATE TABLE "watchlist"."watch_item_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by_id" text NOT NULL,
	"updated_by_id" text,
	"watch_item_id" text NOT NULL,
	"watch_tag_id" text NOT NULL,
	CONSTRAINT "watch_item_tags_watch_item_id_watch_tag_id_unique" UNIQUE("watch_item_id","watch_tag_id")
);
--> statement-breakpoint
CREATE TABLE "watchlist"."watch_items" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by_id" text NOT NULL,
	"updated_by_id" text,
	"title" text NOT NULL,
	"type" "watchlist"."watch_item_type" NOT NULL,
	"seasons" integer,
	CONSTRAINT "watch_items_title_unique" UNIQUE("title")
);
--> statement-breakpoint
CREATE TABLE "watchlist"."watch_languages" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by_id" text NOT NULL,
	"updated_by_id" text,
	"language" text NOT NULL,
	CONSTRAINT "watch_languages_language_unique" UNIQUE("language")
);
--> statement-breakpoint
CREATE TABLE "watchlist"."watch_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by_id" text NOT NULL,
	"updated_by_id" text,
	"name" text NOT NULL,
	CONSTRAINT "watch_tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "auth"."user" ADD COLUMN "role" "user_role" DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_item_languages" ADD CONSTRAINT "watch_item_languages_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_item_languages" ADD CONSTRAINT "watch_item_languages_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_item_languages" ADD CONSTRAINT "watch_item_languages_watch_item_id_watch_items_id_fk" FOREIGN KEY ("watch_item_id") REFERENCES "watchlist"."watch_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_item_languages" ADD CONSTRAINT "watch_item_languages_watch_language_id_watch_languages_id_fk" FOREIGN KEY ("watch_language_id") REFERENCES "watchlist"."watch_languages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_item_ratings" ADD CONSTRAINT "watch_item_ratings_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_item_ratings" ADD CONSTRAINT "watch_item_ratings_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_item_ratings" ADD CONSTRAINT "watch_item_ratings_watch_item_id_watch_items_id_fk" FOREIGN KEY ("watch_item_id") REFERENCES "watchlist"."watch_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_item_tags" ADD CONSTRAINT "watch_item_tags_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_item_tags" ADD CONSTRAINT "watch_item_tags_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_item_tags" ADD CONSTRAINT "watch_item_tags_watch_item_id_watch_items_id_fk" FOREIGN KEY ("watch_item_id") REFERENCES "watchlist"."watch_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_item_tags" ADD CONSTRAINT "watch_item_tags_watch_tag_id_watch_tags_id_fk" FOREIGN KEY ("watch_tag_id") REFERENCES "watchlist"."watch_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_items" ADD CONSTRAINT "watch_items_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_items" ADD CONSTRAINT "watch_items_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_languages" ADD CONSTRAINT "watch_languages_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_languages" ADD CONSTRAINT "watch_languages_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_tags" ADD CONSTRAINT "watch_tags_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_tags" ADD CONSTRAINT "watch_tags_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;