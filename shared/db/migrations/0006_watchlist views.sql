CREATE TABLE "watchlist"."watchlist_views" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"filters" json DEFAULT '{}'::json NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "watchlist_views_user_id_name_unique" UNIQUE("user_id","name")
);
--> statement-breakpoint
ALTER TABLE "watchlist"."watchlist_views" ADD CONSTRAINT "watchlist_views_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watchlist_views" ADD CONSTRAINT "watchlist_views_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."watchlist_views" ADD CONSTRAINT "watchlist_views_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;