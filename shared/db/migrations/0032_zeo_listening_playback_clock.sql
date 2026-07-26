ALTER TYPE "zeo"."listening_playback_state" ADD VALUE IF NOT EXISTS 'loading' BEFORE 'playing';--> statement-breakpoint
ALTER TABLE "zeo"."listening_sessions" ADD COLUMN "position_updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "zeo"."listening_sessions" ADD COLUMN "playback_generation" integer DEFAULT 0 NOT NULL;
