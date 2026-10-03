ALTER TABLE "chhanchhan"."finance_space_allocations" ADD COLUMN "batch_id" uuid;
--> statement-breakpoint
UPDATE "chhanchhan"."finance_space_allocations" SET "batch_id" = "id" WHERE "batch_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_allocations" ALTER COLUMN "batch_id" SET NOT NULL;
--> statement-breakpoint
CREATE INDEX "finance_space_allocations_batch_id_idx" ON "chhanchhan"."finance_space_allocations" USING btree ("batch_id");
