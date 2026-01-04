CREATE TYPE "watchlist"."watch_item_release_status" AS ENUM('released', 'on-going', 'coming-soon');--> statement-breakpoint
CREATE TYPE "watchlist"."watch_progress_status" AS ENUM('to_watch', 'watching', 'watched', 'dropped');--> statement-breakpoint
ALTER TABLE "watchlist"."watch_item_ratings" ALTER COLUMN "rating" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_item_ratings" ADD COLUMN "progress_status" "watchlist"."watch_progress_status" DEFAULT 'watched';--> statement-breakpoint
ALTER TABLE "watchlist"."watch_item_ratings" ADD COLUMN "dropped_at_season" integer;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_item_ratings" ADD COLUMN "dropped_at_episode" integer;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_items" ADD COLUMN "release_status" "watchlist"."watch_item_release_status" DEFAULT 'released';