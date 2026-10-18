CREATE TYPE "zap"."user_access_status" AS ENUM('default', 'allowed', 'blocked');
--> statement-breakpoint
CREATE TABLE "zap"."user_access" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"status" "zap"."user_access_status" DEFAULT 'default' NOT NULL,
	"first_seen_at" timestamp,
	"last_seen_at" timestamp,
	"updated_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zap"."settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_by_user_id" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "zap"."user_access" ADD CONSTRAINT "user_access_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."user_access" ADD CONSTRAINT "user_access_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "zap"."settings" ADD CONSTRAINT "settings_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "user_access_last_seen_at_idx" ON "zap"."user_access" USING btree ("last_seen_at");
--> statement-breakpoint
CREATE INDEX "user_access_status_idx" ON "zap"."user_access" USING btree ("status");
--> statement-breakpoint
INSERT INTO "zap"."settings" ("key", "value") VALUES ('access_mode', 'open') ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Default system tags used to be re-seeded at runtime; seed once here so admin deletes stick.
INSERT INTO "zap"."tags" ("name", "slug", "kind", "owner_user_id")
VALUES
	('slow', 'slow', 'system', NULL),
	('ignite', 'ignite', 'system', NULL),
	('blast', 'blast', 'system', NULL),
	('love', 'love', 'system', NULL),
	('sad', 'sad', 'system', NULL),
	('happy', 'happy', 'system', NULL),
	('upbeat', 'upbeat', 'system', NULL),
	('rap', 'rap', 'system', NULL)
ON CONFLICT DO NOTHING;
