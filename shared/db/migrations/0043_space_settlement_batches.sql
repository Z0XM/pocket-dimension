CREATE TABLE "chhanchhan"."finance_space_settlement_batches" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"space_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"incoming_transaction_ids" uuid[] NOT NULL,
	"outgoing_transaction_ids" uuid[] NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_settlement_batches" ADD CONSTRAINT "finance_space_settlement_batches_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_settlement_batches" ADD CONSTRAINT "finance_space_settlement_batches_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_settlement_batches" ADD CONSTRAINT "finance_space_settlement_batches_space_id_finance_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "chhanchhan"."finance_spaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "finance_space_settlement_batches_space_id_idx" ON "chhanchhan"."finance_space_settlement_batches" USING btree ("space_id");
--> statement-breakpoint
INSERT INTO "chhanchhan"."finance_space_settlement_batches" (
	"id",
	"created_at",
	"updated_at",
	"created_by_id",
	"updated_by_id",
	"space_id",
	"amount_minor",
	"incoming_transaction_ids",
	"outgoing_transaction_ids"
)
SELECT
	a."batch_id",
	MIN(a."created_at"),
	MIN(a."created_at"),
	(array_agg(a."created_by_id" ORDER BY a."created_at"))[1],
	(array_agg(a."updated_by_id" ORDER BY a."created_at"))[1],
	a."space_id",
	SUM(a."amount_minor")::bigint,
	array_agg(DISTINCT a."left_transaction_id"),
	array_agg(DISTINCT a."right_transaction_id")
FROM "chhanchhan"."finance_space_allocations" a
GROUP BY a."batch_id", a."space_id";
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_allocations" ADD CONSTRAINT "finance_space_allocations_batch_id_finance_space_settlement_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "chhanchhan"."finance_space_settlement_batches"("id") ON DELETE cascade ON UPDATE no action;
