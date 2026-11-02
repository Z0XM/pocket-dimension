-- Connected YouTube → Zap playlist mirror: link, sync mode, and auto-sync interval.
CREATE TYPE "zap"."youtube_playlist_sync_mode" AS ENUM('additive', 'exact');
--> statement-breakpoint
CREATE TYPE "zap"."youtube_playlist_sync_interval" AS ENUM('off', 'hourly', 'every_6_hours', 'daily');
--> statement-breakpoint
ALTER TABLE "zap"."youtube_playlist_prefs" ADD COLUMN "zap_playlist_id" uuid;
--> statement-breakpoint
ALTER TABLE "zap"."youtube_playlist_prefs" ADD COLUMN "sync_mode" "zap"."youtube_playlist_sync_mode" DEFAULT 'additive' NOT NULL;
--> statement-breakpoint
ALTER TABLE "zap"."youtube_playlist_prefs" ADD COLUMN "sync_interval" "zap"."youtube_playlist_sync_interval" DEFAULT 'off' NOT NULL;
--> statement-breakpoint
ALTER TABLE "zap"."youtube_playlist_prefs" ADD CONSTRAINT "youtube_playlist_prefs_zap_playlist_id_playlists_id_fk" FOREIGN KEY ("zap_playlist_id") REFERENCES "zap"."playlists"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "youtube_playlist_prefs_zap_playlist_id_idx" ON "zap"."youtube_playlist_prefs" USING btree ("zap_playlist_id");
