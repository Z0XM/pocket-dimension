ALTER TABLE "watchlist"."watch_item_ratings" ALTER COLUMN "rating" SET DATA TYPE numeric USING "rating"::numeric;
