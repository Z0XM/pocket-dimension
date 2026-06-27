CREATE TYPE "zeo"."waiting_entry_status" AS ENUM('pending', 'admitted', 'denied');--> statement-breakpoint
CREATE TABLE "zeo"."chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"room_id" uuid NOT NULL,
	"sender_identity" text NOT NULL,
	"sender_display_name" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zeo"."room_waiting_entries" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"room_id" uuid NOT NULL,
	"participant_identity" text NOT NULL,
	"display_name" text NOT NULL,
	"status" "zeo"."waiting_entry_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp NOT NULL,
	"resolved_at" timestamp,
	"resolved_by_id" uuid,
	CONSTRAINT "room_waiting_entries_room_id_participant_identity_unique" UNIQUE("room_id","participant_identity")
);
--> statement-breakpoint
ALTER TABLE "zeo"."rooms" ADD COLUMN "waiting_room_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "zeo"."chat_messages" ADD CONSTRAINT "chat_messages_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "zeo"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."room_waiting_entries" ADD CONSTRAINT "room_waiting_entries_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "zeo"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."room_waiting_entries" ADD CONSTRAINT "room_waiting_entries_resolved_by_id_user_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_room_id_idx" ON "zeo"."chat_messages" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "chat_messages_room_id_created_at_idx" ON "zeo"."chat_messages" USING btree ("room_id","created_at");--> statement-breakpoint
CREATE INDEX "room_waiting_entries_room_id_status_idx" ON "zeo"."room_waiting_entries" USING btree ("room_id","status");