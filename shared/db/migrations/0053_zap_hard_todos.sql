ALTER TABLE "zap"."sessions" ADD COLUMN "auto_play" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
CREATE TYPE "zap"."playlist_visibility" AS ENUM('private', 'public');
--> statement-breakpoint
CREATE TYPE "zap"."playlist_member_role" AS ENUM('owner', 'collaborator');
--> statement-breakpoint
CREATE TABLE "zap"."playlists" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"visibility" "zap"."playlist_visibility" DEFAULT 'private' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zap"."playlist_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"playlist_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"added_by_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zap"."playlist_exclusions" (
	"playlist_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "playlist_exclusions_playlist_id_media_asset_id_pk" PRIMARY KEY("playlist_id","media_asset_id")
);
--> statement-breakpoint
CREATE TABLE "zap"."playlist_members" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"playlist_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "zap"."playlist_member_role" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "zap"."playlists" ADD CONSTRAINT "playlists_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."playlist_items" ADD CONSTRAINT "playlist_items_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "zap"."playlists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."playlist_items" ADD CONSTRAINT "playlist_items_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "zap"."media_assets"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."playlist_items" ADD CONSTRAINT "playlist_items_added_by_user_id_user_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."playlist_exclusions" ADD CONSTRAINT "playlist_exclusions_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "zap"."playlists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."playlist_exclusions" ADD CONSTRAINT "playlist_exclusions_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "zap"."media_assets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."playlist_members" ADD CONSTRAINT "playlist_members_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "zap"."playlists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."playlist_members" ADD CONSTRAINT "playlist_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "playlists_owner_user_id_idx" ON "zap"."playlists" USING btree ("owner_user_id");
--> statement-breakpoint
CREATE INDEX "playlists_visibility_idx" ON "zap"."playlists" USING btree ("visibility");
--> statement-breakpoint
CREATE UNIQUE INDEX "playlist_items_playlist_position_unique" ON "zap"."playlist_items" USING btree ("playlist_id","position");
--> statement-breakpoint
CREATE UNIQUE INDEX "playlist_items_playlist_asset_unique" ON "zap"."playlist_items" USING btree ("playlist_id","media_asset_id");
--> statement-breakpoint
CREATE INDEX "playlist_items_playlist_id_idx" ON "zap"."playlist_items" USING btree ("playlist_id");
--> statement-breakpoint
CREATE INDEX "playlist_items_media_asset_id_idx" ON "zap"."playlist_items" USING btree ("media_asset_id");
--> statement-breakpoint
CREATE INDEX "playlist_exclusions_playlist_id_idx" ON "zap"."playlist_exclusions" USING btree ("playlist_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "playlist_members_playlist_user_unique" ON "zap"."playlist_members" USING btree ("playlist_id","user_id");
--> statement-breakpoint
CREATE INDEX "playlist_members_user_id_idx" ON "zap"."playlist_members" USING btree ("user_id");
