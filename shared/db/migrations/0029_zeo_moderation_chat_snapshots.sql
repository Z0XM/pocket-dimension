ALTER TABLE "zeo"."rooms" ADD COLUMN "is_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TYPE "zeo"."chat_message_kind" AS ENUM('text', 'snapshot');--> statement-breakpoint
ALTER TABLE "zeo"."chat_messages" ADD COLUMN "kind" "zeo"."chat_message_kind" DEFAULT 'text' NOT NULL;
