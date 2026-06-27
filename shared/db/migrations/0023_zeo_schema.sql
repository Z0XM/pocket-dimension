CREATE SCHEMA "zeo";
--> statement-breakpoint
CREATE TYPE "zeo"."room_status" AS ENUM('waiting', 'active', 'ended');--> statement-breakpoint
CREATE TYPE "zeo"."session_block_reason" AS ENUM('removed');--> statement-breakpoint
CREATE TABLE "zeo"."room_participants" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid,
	"guest_display_name" text,
	"is_guest" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp NOT NULL,
	"left_at" timestamp,
	"removed_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "zeo"."room_session_blocks" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"room_id" uuid NOT NULL,
	"participant_identity" text NOT NULL,
	"blocked_at" timestamp NOT NULL,
	"blocked_by_id" uuid NOT NULL,
	"reason" "zeo"."session_block_reason" DEFAULT 'removed' NOT NULL,
	CONSTRAINT "room_session_blocks_room_id_participant_identity_unique" UNIQUE("room_id","participant_identity")
);
--> statement-breakpoint
CREATE TABLE "zeo"."rooms" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"slug" text NOT NULL,
	"livekit_room_name" text NOT NULL,
	"display_name" text NOT NULL,
	"host_user_id" uuid NOT NULL,
	"status" "zeo"."room_status" DEFAULT 'waiting' NOT NULL,
	"max_participants" integer DEFAULT 6 NOT NULL,
	"ended_at" timestamp,
	CONSTRAINT "rooms_slug_unique" UNIQUE("slug"),
	CONSTRAINT "rooms_livekit_room_name_unique" UNIQUE("livekit_room_name")
);
--> statement-breakpoint
ALTER TABLE "zeo"."room_participants" ADD CONSTRAINT "room_participants_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "zeo"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."room_participants" ADD CONSTRAINT "room_participants_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."room_participants" ADD CONSTRAINT "room_participants_removed_by_id_user_id_fk" FOREIGN KEY ("removed_by_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."room_session_blocks" ADD CONSTRAINT "room_session_blocks_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "zeo"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."room_session_blocks" ADD CONSTRAINT "room_session_blocks_blocked_by_id_user_id_fk" FOREIGN KEY ("blocked_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."rooms" ADD CONSTRAINT "rooms_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."rooms" ADD CONSTRAINT "rooms_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."rooms" ADD CONSTRAINT "rooms_host_user_id_user_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "room_participants_room_id_idx" ON "zeo"."room_participants" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "room_participants_user_id_idx" ON "zeo"."room_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "room_session_blocks_room_id_idx" ON "zeo"."room_session_blocks" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "rooms_host_user_id_idx" ON "zeo"."rooms" USING btree ("host_user_id");--> statement-breakpoint
CREATE INDEX "rooms_status_idx" ON "zeo"."rooms" USING btree ("status");