ALTER TYPE "zeo"."room_status" ADD VALUE IF NOT EXISTS 'stale';--> statement-breakpoint
ALTER TABLE "zeo"."rooms" ADD COLUMN "is_perpetual" boolean DEFAULT false NOT NULL;
