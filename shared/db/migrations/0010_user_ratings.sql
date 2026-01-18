CREATE TABLE "watchlist"."user_rating_preferences" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"user_id" uuid NOT NULL,
	"preferred_user_id" uuid NOT NULL,
	CONSTRAINT "user_rating_preferences_user_id_preferred_user_id_unique" UNIQUE("user_id","preferred_user_id")
);
--> statement-breakpoint
ALTER TABLE "watchlist"."user_rating_preferences" ADD CONSTRAINT "user_rating_preferences_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."user_rating_preferences" ADD CONSTRAINT "user_rating_preferences_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."user_rating_preferences" ADD CONSTRAINT "user_rating_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."user_rating_preferences" ADD CONSTRAINT "user_rating_preferences_preferred_user_id_user_id_fk" FOREIGN KEY ("preferred_user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;