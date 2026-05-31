CREATE TABLE "chhanchhan"."finance_groups" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color_hex" text,
	CONSTRAINT "finance_groups_account_id_name_unique" UNIQUE("account_id","name")
);
--> statement-breakpoint
CREATE TABLE "chhanchhan"."finance_transaction_groups" (
	"transaction_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	CONSTRAINT "finance_transaction_groups_transaction_id_group_id_pk" PRIMARY KEY("transaction_id","group_id")
);
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_groups" ADD CONSTRAINT "finance_groups_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_groups" ADD CONSTRAINT "finance_groups_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_groups" ADD CONSTRAINT "finance_groups_account_id_finance_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "chhanchhan"."finance_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_transaction_groups" ADD CONSTRAINT "finance_transaction_groups_transaction_id_finance_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "chhanchhan"."finance_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_transaction_groups" ADD CONSTRAINT "finance_transaction_groups_group_id_finance_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "chhanchhan"."finance_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "finance_groups_account_id_idx" ON "chhanchhan"."finance_groups" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "finance_transaction_groups_group_id_idx" ON "chhanchhan"."finance_transaction_groups" USING btree ("group_id");
