CREATE TYPE "chhanchhan"."settlement_pocket_kind" AS ENUM('in_pocket', 'out_pocket');
--> statement-breakpoint
CREATE TABLE "chhanchhan"."finance_space_settlement_pockets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"space_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"kind" "chhanchhan"."settlement_pocket_kind" NOT NULL,
	"amount_minor" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_settlement_pockets" ADD CONSTRAINT "finance_space_settlement_pockets_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_settlement_pockets" ADD CONSTRAINT "finance_space_settlement_pockets_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_settlement_pockets" ADD CONSTRAINT "finance_space_settlement_pockets_space_id_finance_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "chhanchhan"."finance_spaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_settlement_pockets" ADD CONSTRAINT "finance_space_settlement_pockets_batch_id_finance_space_settlement_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "chhanchhan"."finance_space_settlement_batches"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_settlement_pockets" ADD CONSTRAINT "finance_space_settlement_pockets_transaction_id_finance_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "chhanchhan"."finance_transactions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "finance_space_settlement_pockets_space_id_idx" ON "chhanchhan"."finance_space_settlement_pockets" USING btree ("space_id");
--> statement-breakpoint
CREATE INDEX "finance_space_settlement_pockets_batch_id_idx" ON "chhanchhan"."finance_space_settlement_pockets" USING btree ("batch_id");
--> statement-breakpoint
CREATE INDEX "finance_space_settlement_pockets_transaction_id_idx" ON "chhanchhan"."finance_space_settlement_pockets" USING btree ("transaction_id");
