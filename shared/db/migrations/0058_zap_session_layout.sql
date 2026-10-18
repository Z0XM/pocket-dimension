-- Session layout redesign: perpetual/stale sessions + per-member permissions & output.
ALTER TABLE "zap"."sessions" ADD COLUMN "perpetual" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "zap"."sessions" ADD COLUMN "stale_at" timestamp;
--> statement-breakpoint
ALTER TABLE "zap"."session_members" ADD COLUMN "can_add" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "zap"."session_members" ADD COLUMN "can_play_pause" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "zap"."session_members" ADD COLUMN "can_skip" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "zap"."session_members" ADD COLUMN "can_seek" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "zap"."session_members" ADD COLUMN "can_reorder" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "zap"."session_members" ADD COLUMN "can_setup" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "zap"."session_members" ADD COLUMN "output_enabled" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "zap"."session_members" ADD COLUMN "volume" integer DEFAULT 100 NOT NULL;
--> statement-breakpoint
-- Seed guest grants from the old session-wide flags (host always full via role).
UPDATE "zap"."session_members" AS m
SET
	"can_add" = s."guests_can_add",
	"can_play_pause" = s."guests_can_control",
	"can_skip" = s."guests_can_control",
	"can_seek" = s."guests_can_control",
	"can_reorder" = (s."guests_can_add" OR s."guests_can_control"),
	"can_setup" = false
FROM "zap"."sessions" AS s
WHERE m."session_id" = s."id" AND m."role" = 'guest';
--> statement-breakpoint
ALTER TABLE "zap"."sessions" DROP COLUMN IF EXISTS "guests_can_add";
--> statement-breakpoint
ALTER TABLE "zap"."sessions" DROP COLUMN IF EXISTS "guests_can_control";
--> statement-breakpoint
CREATE INDEX "sessions_host_perpetual_idx" ON "zap"."sessions" USING btree ("host_user_id","perpetual") WHERE "zap"."sessions"."perpetual" = true;
--> statement-breakpoint
CREATE INDEX "sessions_stale_at_idx" ON "zap"."sessions" USING btree ("stale_at") WHERE "zap"."sessions"."stale_at" IS NOT NULL;
