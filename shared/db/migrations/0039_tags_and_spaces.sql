-- Tags + Spaces classifier revamp.
-- Removes categories, groups, and refund-links. Keeps transactions/accounts.
-- Tag/transaction-tag rows are wiped so seed taxonomy can be reapplied cleanly.

ALTER TABLE "chhanchhan"."finance_budgets" DROP CONSTRAINT IF EXISTS "finance_budgets_category_id_finance_categories_id_fk";
ALTER TABLE "chhanchhan"."finance_transactions" DROP CONSTRAINT IF EXISTS "finance_transactions_category_id_finance_categories_id_fk";

DROP TABLE IF EXISTS "chhanchhan"."finance_transaction_refund_links" CASCADE;
DROP TABLE IF EXISTS "chhanchhan"."finance_transaction_groups" CASCADE;
DROP TABLE IF EXISTS "chhanchhan"."finance_groups" CASCADE;
DROP TABLE IF EXISTS "chhanchhan"."finance_budgets" CASCADE;
DROP TABLE IF EXISTS "chhanchhan"."finance_transaction_tags" CASCADE;
DROP TABLE IF EXISTS "chhanchhan"."finance_tags" CASCADE;
DROP TABLE IF EXISTS "chhanchhan"."finance_categories" CASCADE;
DROP TABLE IF EXISTS "chhanchhan"."finance_space_allocations" CASCADE;
DROP TABLE IF EXISTS "chhanchhan"."finance_space_transactions" CASCADE;
DROP TABLE IF EXISTS "chhanchhan"."finance_spaces" CASCADE;

ALTER TABLE "chhanchhan"."finance_transactions" DROP COLUMN IF EXISTS "category_id";
DROP INDEX IF EXISTS "chhanchhan"."finance_transactions_account_id_category_id_idx";

CREATE TABLE "chhanchhan"."finance_tags" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color_hex" text,
	"kind" "chhanchhan"."transaction_type"
);
--> statement-breakpoint
CREATE TABLE "chhanchhan"."finance_transaction_tags" (
	"transaction_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "finance_transaction_tags_transaction_id_tag_id_pk" PRIMARY KEY("transaction_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "chhanchhan"."finance_spaces" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color_hex" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "chhanchhan"."finance_space_transactions" (
	"space_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	CONSTRAINT "finance_space_transactions_space_id_transaction_id_pk" PRIMARY KEY("space_id","transaction_id")
);
--> statement-breakpoint
CREATE TABLE "chhanchhan"."finance_space_allocations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"space_id" uuid NOT NULL,
	"left_transaction_id" uuid NOT NULL,
	"right_transaction_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chhanchhan"."finance_budgets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"account_id" uuid NOT NULL,
	"tag_id" uuid,
	"name" text NOT NULL,
	"period" "chhanchhan"."budget_period" DEFAULT 'monthly' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"limit_minor" bigint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_tags" ADD CONSTRAINT "finance_tags_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_tags" ADD CONSTRAINT "finance_tags_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_tags" ADD CONSTRAINT "finance_tags_account_id_finance_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "chhanchhan"."finance_accounts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_transaction_tags" ADD CONSTRAINT "finance_transaction_tags_transaction_id_finance_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "chhanchhan"."finance_transactions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_transaction_tags" ADD CONSTRAINT "finance_transaction_tags_tag_id_finance_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "chhanchhan"."finance_tags"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_spaces" ADD CONSTRAINT "finance_spaces_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_spaces" ADD CONSTRAINT "finance_spaces_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_spaces" ADD CONSTRAINT "finance_spaces_account_id_finance_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "chhanchhan"."finance_accounts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_transactions" ADD CONSTRAINT "finance_space_transactions_space_id_finance_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "chhanchhan"."finance_spaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_transactions" ADD CONSTRAINT "finance_space_transactions_transaction_id_finance_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "chhanchhan"."finance_transactions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_allocations" ADD CONSTRAINT "finance_space_allocations_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_allocations" ADD CONSTRAINT "finance_space_allocations_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_allocations" ADD CONSTRAINT "finance_space_allocations_space_id_finance_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "chhanchhan"."finance_spaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_allocations" ADD CONSTRAINT "finance_space_allocations_left_transaction_id_finance_transactions_id_fk" FOREIGN KEY ("left_transaction_id") REFERENCES "chhanchhan"."finance_transactions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_allocations" ADD CONSTRAINT "finance_space_allocations_right_transaction_id_finance_transactions_id_fk" FOREIGN KEY ("right_transaction_id") REFERENCES "chhanchhan"."finance_transactions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_budgets" ADD CONSTRAINT "finance_budgets_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_budgets" ADD CONSTRAINT "finance_budgets_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_budgets" ADD CONSTRAINT "finance_budgets_account_id_finance_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "chhanchhan"."finance_accounts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_budgets" ADD CONSTRAINT "finance_budgets_tag_id_finance_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "chhanchhan"."finance_tags"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "finance_tags_account_id_name_unique" ON "chhanchhan"."finance_tags" USING btree ("account_id","name");
--> statement-breakpoint
CREATE INDEX "finance_tags_account_id_idx" ON "chhanchhan"."finance_tags" USING btree ("account_id");
--> statement-breakpoint
CREATE INDEX "finance_transaction_tags_tag_id_idx" ON "chhanchhan"."finance_transaction_tags" USING btree ("tag_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "finance_spaces_account_id_name_unique" ON "chhanchhan"."finance_spaces" USING btree ("account_id","name");
--> statement-breakpoint
CREATE INDEX "finance_spaces_account_id_idx" ON "chhanchhan"."finance_spaces" USING btree ("account_id");
--> statement-breakpoint
CREATE INDEX "finance_space_transactions_transaction_id_idx" ON "chhanchhan"."finance_space_transactions" USING btree ("transaction_id");
--> statement-breakpoint
CREATE INDEX "finance_space_allocations_space_id_idx" ON "chhanchhan"."finance_space_allocations" USING btree ("space_id");
--> statement-breakpoint
CREATE INDEX "finance_space_allocations_left_txn_idx" ON "chhanchhan"."finance_space_allocations" USING btree ("left_transaction_id");
--> statement-breakpoint
CREATE INDEX "finance_space_allocations_right_txn_idx" ON "chhanchhan"."finance_space_allocations" USING btree ("right_transaction_id");
--> statement-breakpoint
CREATE INDEX "finance_budgets_account_id_idx" ON "chhanchhan"."finance_budgets" USING btree ("account_id");
