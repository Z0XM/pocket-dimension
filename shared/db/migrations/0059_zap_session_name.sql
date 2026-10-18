-- Named listening sessions (list rename + create-with-name).
ALTER TABLE "zap"."sessions" ADD COLUMN "name" text DEFAULT '' NOT NULL;
--> statement-breakpoint
UPDATE "zap"."sessions" SET "name" = 'Session ' || "join_code" WHERE "name" = '';
