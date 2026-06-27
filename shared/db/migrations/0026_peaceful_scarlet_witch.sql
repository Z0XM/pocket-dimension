CREATE TABLE "zeo"."operator_settings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"max_concurrent_rooms" integer DEFAULT 2 NOT NULL,
	"max_participants_per_room" integer DEFAULT 6 NOT NULL,
	"chat_enabled" boolean DEFAULT true NOT NULL,
	"waiting_room_default_enabled" boolean DEFAULT false NOT NULL,
	"scheduled_rooms_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp NOT NULL,
	"updated_by_id" uuid
);
--> statement-breakpoint
ALTER TABLE "zeo"."rooms" ADD COLUMN "scheduled_start_at" timestamp;--> statement-breakpoint
ALTER TABLE "zeo"."rooms" ADD COLUMN "force_ended_by_id" uuid;--> statement-breakpoint
ALTER TABLE "zeo"."operator_settings" ADD CONSTRAINT "operator_settings_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeo"."rooms" ADD CONSTRAINT "rooms_force_ended_by_id_user_id_fk" FOREIGN KEY ("force_ended_by_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rooms_scheduled_start_at_idx" ON "zeo"."rooms" USING btree ("scheduled_start_at");