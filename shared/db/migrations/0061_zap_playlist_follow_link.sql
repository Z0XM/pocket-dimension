-- Playlist share codes, follows, and multi-source linked playlists.
CREATE TYPE "zap"."playlist_kind" AS ENUM('standard', 'linked');
--> statement-breakpoint
ALTER TABLE "zap"."playlists" ADD COLUMN "kind" "zap"."playlist_kind" DEFAULT 'standard' NOT NULL;
--> statement-breakpoint
ALTER TABLE "zap"."playlists" ADD COLUMN "share_code" text;
--> statement-breakpoint
UPDATE "zap"."playlists"
SET "share_code" = upper(substr(md5(id::text || random()::text), 1, 8))
WHERE "share_code" IS NULL;
--> statement-breakpoint
ALTER TABLE "zap"."playlists" ALTER COLUMN "share_code" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "playlists_share_code_unique" ON "zap"."playlists" USING btree ("share_code");
--> statement-breakpoint
CREATE INDEX "playlists_kind_idx" ON "zap"."playlists" USING btree ("kind");
--> statement-breakpoint
CREATE TABLE "zap"."playlist_follows" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"playlist_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zap"."linked_playlist_sources" (
	"linked_playlist_id" uuid NOT NULL,
	"source_playlist_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "linked_playlist_sources_linked_playlist_id_source_playlist_id_pk" PRIMARY KEY("linked_playlist_id","source_playlist_id")
);
--> statement-breakpoint
ALTER TABLE "zap"."playlist_follows" ADD CONSTRAINT "playlist_follows_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "zap"."playlists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."playlist_follows" ADD CONSTRAINT "playlist_follows_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."linked_playlist_sources" ADD CONSTRAINT "linked_playlist_sources_linked_playlist_id_playlists_id_fk" FOREIGN KEY ("linked_playlist_id") REFERENCES "zap"."playlists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."linked_playlist_sources" ADD CONSTRAINT "linked_playlist_sources_source_playlist_id_playlists_id_fk" FOREIGN KEY ("source_playlist_id") REFERENCES "zap"."playlists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "playlist_follows_playlist_user_unique" ON "zap"."playlist_follows" USING btree ("playlist_id","user_id");
--> statement-breakpoint
CREATE INDEX "playlist_follows_user_id_idx" ON "zap"."playlist_follows" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "playlist_follows_playlist_id_idx" ON "zap"."playlist_follows" USING btree ("playlist_id");
--> statement-breakpoint
CREATE INDEX "linked_playlist_sources_source_idx" ON "zap"."linked_playlist_sources" USING btree ("source_playlist_id");
