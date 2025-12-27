ALTER TABLE "auth"."user" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "auth"."user" ADD COLUMN "display_username" text;--> statement-breakpoint
ALTER TABLE "auth"."user" ADD CONSTRAINT "user_username_unique" UNIQUE("username");