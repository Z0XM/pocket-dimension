ALTER TABLE "zeo"."rooms" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "rooms_is_public_status_idx" ON "zeo"."rooms" USING btree ("is_public","status");
