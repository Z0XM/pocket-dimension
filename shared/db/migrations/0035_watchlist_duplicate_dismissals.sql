CREATE TABLE "watchlist"."duplicate_dismissals" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"fingerprint" text NOT NULL,
	"item_ids" json NOT NULL,
	"tier" text NOT NULL,
	"reason" text,
	CONSTRAINT "duplicate_dismissals_fingerprint_unique" UNIQUE("fingerprint")
);
--> statement-breakpoint
ALTER TABLE "watchlist"."duplicate_dismissals" ADD CONSTRAINT "duplicate_dismissals_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist"."duplicate_dismissals" ADD CONSTRAINT "duplicate_dismissals_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
