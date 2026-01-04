CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE SCHEMA "watchlist";
--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'contributor', 'admin');--> statement-breakpoint
CREATE TYPE "watchlist"."watch_item_type" AS ENUM('movie', 'series', 'shorts');--> statement-breakpoint
CREATE TYPE "watchlist"."watch_recommendations" AS ENUM('must_watch', 'go_for_it', 'one_time_watch', 'skip_it');--> statement-breakpoint
CREATE TABLE "auth"."account" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text
);
--> statement-breakpoint
CREATE TABLE "auth"."session" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth"."user" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"username" text,
	"display_username" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "auth"."verification" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist"."watch_item_ratings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"watch_item_id" uuid NOT NULL,
	"rating" integer,
	"infinity" boolean DEFAULT false,
	"shitty" boolean DEFAULT false,
	"recommendation" "watchlist"."watch_recommendations" DEFAULT 'go_for_it',
	"review" text DEFAULT '',
	CONSTRAINT "watch_item_ratings_watch_item_id_rating_unique" UNIQUE("watch_item_id","rating")
);
--> statement-breakpoint
CREATE TABLE "watchlist"."watch_item_tags" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"watch_item_id" uuid NOT NULL,
	"watch_tag_id" uuid NOT NULL,
	CONSTRAINT "watch_item_tags_watch_item_id_watch_tag_id_unique" UNIQUE("watch_item_id","watch_tag_id")
);
--> statement-breakpoint
CREATE TABLE "watchlist"."watch_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"title" text NOT NULL,
	"type" "watchlist"."watch_item_type" NOT NULL,
	"seasons" integer,
	"language_id" uuid NOT NULL,
	CONSTRAINT "watch_items_title_unique" UNIQUE("title")
);
--> statement-breakpoint
CREATE TABLE "watchlist"."watch_languages" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"language" text NOT NULL,
	CONSTRAINT "watch_languages_language_unique" UNIQUE("language")
);
--> statement-breakpoint
CREATE TABLE "watchlist"."watch_tags" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"name" text NOT NULL,
	CONSTRAINT "watch_tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "auth"."account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_item_ratings" ADD CONSTRAINT "watch_item_ratings_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_item_ratings" ADD CONSTRAINT "watch_item_ratings_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_item_ratings" ADD CONSTRAINT "watch_item_ratings_watch_item_id_watch_items_id_fk" FOREIGN KEY ("watch_item_id") REFERENCES "watchlist"."watch_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_item_tags" ADD CONSTRAINT "watch_item_tags_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_item_tags" ADD CONSTRAINT "watch_item_tags_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_item_tags" ADD CONSTRAINT "watch_item_tags_watch_item_id_watch_items_id_fk" FOREIGN KEY ("watch_item_id") REFERENCES "watchlist"."watch_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_item_tags" ADD CONSTRAINT "watch_item_tags_watch_tag_id_watch_tags_id_fk" FOREIGN KEY ("watch_tag_id") REFERENCES "watchlist"."watch_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_items" ADD CONSTRAINT "watch_items_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_items" ADD CONSTRAINT "watch_items_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_items" ADD CONSTRAINT "watch_items_language_id_watch_languages_id_fk" FOREIGN KEY ("language_id") REFERENCES "watchlist"."watch_languages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_languages" ADD CONSTRAINT "watch_languages_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_languages" ADD CONSTRAINT "watch_languages_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_tags" ADD CONSTRAINT "watch_tags_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_tags" ADD CONSTRAINT "watch_tags_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "auth"."account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "auth"."session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "auth"."verification" USING btree ("identifier");