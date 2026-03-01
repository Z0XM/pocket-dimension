CREATE TABLE "howwasyourday"."push_subscription" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth_key" text NOT NULL,
	"timezone" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_notified_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "howwasyourday"."push_subscription" ADD CONSTRAINT "push_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_sub_user_id_idx" ON "howwasyourday"."push_subscription" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "push_sub_timezone_idx" ON "howwasyourday"."push_subscription" USING btree ("timezone");