ALTER TABLE "watchlist"."watch_item_ratings" ALTER COLUMN "progress_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "watchlist"."watch_item_ratings" ALTER COLUMN "progress_status" SET DEFAULT 'watched'::text;--> statement-breakpoint
DROP TYPE "watchlist"."watch_progress_status";--> statement-breakpoint
CREATE TYPE "watchlist"."watch_progress_status" AS ENUM('watch_later', 'watching', 'watched', 'dropped');--> statement-breakpoint
ALTER TABLE "watchlist"."watch_item_ratings" ALTER COLUMN "progress_status" SET DEFAULT 'watched'::"watchlist"."watch_progress_status";--> statement-breakpoint
ALTER TABLE "watchlist"."watch_item_ratings" ALTER COLUMN "progress_status" SET DATA TYPE "watchlist"."watch_progress_status" USING "progress_status"::"watchlist"."watch_progress_status";