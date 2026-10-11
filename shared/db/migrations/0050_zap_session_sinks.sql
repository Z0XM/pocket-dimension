CREATE TYPE "zap"."session_sink_type" AS ENUM('web', 'discord');
--> statement-breakpoint
CREATE TYPE "zap"."session_sink_status" AS ENUM('pending', 'active', 'error', 'detached');
--> statement-breakpoint
CREATE TABLE "zap"."session_sinks" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"session_id" uuid NOT NULL,
	"type" "zap"."session_sink_type" NOT NULL,
	"status" "zap"."session_sink_status" DEFAULT 'pending' NOT NULL,
	"external_guild_id" text,
	"external_channel_id" text,
	"config_json" text,
	"error_message" text,
	"attached_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"detached_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "zap"."session_sinks" ADD CONSTRAINT "session_sinks_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "zap"."sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."session_sinks" ADD CONSTRAINT "session_sinks_attached_by_user_id_user_id_fk" FOREIGN KEY ("attached_by_user_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "session_sinks_session_id_idx" ON "zap"."session_sinks" USING btree ("session_id");
--> statement-breakpoint
CREATE INDEX "session_sinks_type_idx" ON "zap"."session_sinks" USING btree ("type");
--> statement-breakpoint
CREATE UNIQUE INDEX "session_sinks_one_active_discord" ON "zap"."session_sinks" USING btree ("session_id","type") WHERE "type" = 'discord' AND "detached_at" IS NULL;
