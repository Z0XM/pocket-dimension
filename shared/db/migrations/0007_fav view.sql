ALTER TABLE "watchlist"."watchlist_views" ADD COLUMN "is_favorite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "watchlist"."watchlist_views" DROP COLUMN "order";