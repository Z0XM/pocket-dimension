ALTER TABLE "zap"."catalog_queues"
  ADD COLUMN IF NOT EXISTS "shuffle_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "zap"."catalog_queues"
  ADD COLUMN IF NOT EXISTS "loop_mode" text DEFAULT 'off' NOT NULL;
