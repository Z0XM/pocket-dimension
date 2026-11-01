-- Persist YouTube playlist import status + hide flag for Connections filters.
CREATE TYPE "zap"."youtube_playlist_import_status" AS ENUM('fully_imported', 'partially_imported', 'not_imported');
--> statement-breakpoint
ALTER TABLE "zap"."youtube_playlist_prefs" ADD COLUMN "hidden" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "zap"."youtube_playlist_prefs" ADD COLUMN "import_status" "zap"."youtube_playlist_import_status" DEFAULT 'not_imported' NOT NULL;
--> statement-breakpoint
ALTER TABLE "zap"."youtube_playlist_prefs" ADD COLUMN "already_imported" integer DEFAULT 0 NOT NULL;
