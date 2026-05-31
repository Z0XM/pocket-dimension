CREATE TABLE "chhanchhan"."finance_transaction_refund_links" (
  "credit_transaction_id" uuid NOT NULL,
  "expense_transaction_id" uuid NOT NULL,
  CONSTRAINT "finance_transaction_refund_links_pkey" PRIMARY KEY("credit_transaction_id","expense_transaction_id")
);
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_transaction_refund_links" ADD CONSTRAINT "finance_transaction_refund_links_credit_transaction_id_finance_transactions_id_fk" FOREIGN KEY ("credit_transaction_id") REFERENCES "chhanchhan"."finance_transactions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_transaction_refund_links" ADD CONSTRAINT "finance_transaction_refund_links_expense_transaction_id_finance_transactions_id_fk" FOREIGN KEY ("expense_transaction_id") REFERENCES "chhanchhan"."finance_transactions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "finance_transaction_refund_links_expense_id_idx" ON "chhanchhan"."finance_transaction_refund_links" USING btree ("expense_transaction_id");
