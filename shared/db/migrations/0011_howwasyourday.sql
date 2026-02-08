CREATE SCHEMA "howwasyourday";
--> statement-breakpoint
CREATE TABLE "howwasyourday"."day_data" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"metadata" json NOT NULL,
	"day_int" integer NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "day_data_user_id_day_int" UNIQUE("user_id","day_int")
);
--> statement-breakpoint
ALTER TABLE "howwasyourday"."day_data" ADD CONSTRAINT "day_data_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "howwasyourday"."day_data" ADD CONSTRAINT "day_data_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;