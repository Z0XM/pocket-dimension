CREATE SCHEMA "chhanchhan";
--> statement-breakpoint
CREATE TYPE "chhanchhan"."account_member_role" AS ENUM('owner', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "chhanchhan"."budget_period" AS ENUM('monthly', 'weekly', 'custom');--> statement-breakpoint
CREATE TYPE "chhanchhan"."goal_status" AS ENUM('active', 'paused', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "chhanchhan"."transaction_type" AS ENUM('expense', 'income', 'transfer');--> statement-breakpoint
CREATE TABLE "chhanchhan"."finance_account_members" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "chhanchhan"."account_member_role" DEFAULT 'viewer' NOT NULL,
	CONSTRAINT "finance_account_members_account_id_user_id_unique" UNIQUE("account_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "chhanchhan"."finance_accounts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"currency_code" text DEFAULT 'USD' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chhanchhan"."finance_budgets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"account_id" uuid NOT NULL,
	"category_id" uuid,
	"name" text NOT NULL,
	"period" "chhanchhan"."budget_period" DEFAULT 'monthly' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"limit_minor" bigint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chhanchhan"."finance_categories" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "chhanchhan"."transaction_type" DEFAULT 'expense' NOT NULL,
	"color_hex" text,
	"parent_category_id" uuid,
	CONSTRAINT "finance_categories_account_id_name_unique" UNIQUE("account_id","name")
);
--> statement-breakpoint
CREATE TABLE "chhanchhan"."finance_goals" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"target_minor" bigint NOT NULL,
	"current_minor" bigint DEFAULT 0 NOT NULL,
	"target_date" date,
	"status" "chhanchhan"."goal_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chhanchhan"."finance_transactions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"account_id" uuid NOT NULL,
	"category_id" uuid,
	"occurred_on" date NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency_code" text DEFAULT 'USD' NOT NULL,
	"type" "chhanchhan"."transaction_type" NOT NULL,
	"merchant" text,
	"notes" text,
	"external_ref" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_account_members" ADD CONSTRAINT "finance_account_members_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_account_members" ADD CONSTRAINT "finance_account_members_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_account_members" ADD CONSTRAINT "finance_account_members_account_id_finance_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "chhanchhan"."finance_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_account_members" ADD CONSTRAINT "finance_account_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_accounts" ADD CONSTRAINT "finance_accounts_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_accounts" ADD CONSTRAINT "finance_accounts_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_accounts" ADD CONSTRAINT "finance_accounts_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_budgets" ADD CONSTRAINT "finance_budgets_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_budgets" ADD CONSTRAINT "finance_budgets_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_budgets" ADD CONSTRAINT "finance_budgets_account_id_finance_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "chhanchhan"."finance_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_budgets" ADD CONSTRAINT "finance_budgets_category_id_finance_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "chhanchhan"."finance_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_categories" ADD CONSTRAINT "finance_categories_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_categories" ADD CONSTRAINT "finance_categories_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_categories" ADD CONSTRAINT "finance_categories_account_id_finance_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "chhanchhan"."finance_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_goals" ADD CONSTRAINT "finance_goals_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_goals" ADD CONSTRAINT "finance_goals_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_goals" ADD CONSTRAINT "finance_goals_account_id_finance_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "chhanchhan"."finance_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_transactions" ADD CONSTRAINT "finance_transactions_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_transactions" ADD CONSTRAINT "finance_transactions_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_transactions" ADD CONSTRAINT "finance_transactions_account_id_finance_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "chhanchhan"."finance_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_transactions" ADD CONSTRAINT "finance_transactions_category_id_finance_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "chhanchhan"."finance_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "finance_account_members_user_id_idx" ON "chhanchhan"."finance_account_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "finance_accounts_owner_user_id_idx" ON "chhanchhan"."finance_accounts" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "finance_budgets_account_id_idx" ON "chhanchhan"."finance_budgets" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "finance_categories_account_id_idx" ON "chhanchhan"."finance_categories" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "finance_goals_account_id_idx" ON "chhanchhan"."finance_goals" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "finance_transactions_account_id_occurred_on_idx" ON "chhanchhan"."finance_transactions" USING btree ("account_id","occurred_on");--> statement-breakpoint
CREATE INDEX "finance_transactions_account_id_category_id_idx" ON "chhanchhan"."finance_transactions" USING btree ("account_id","category_id");--> statement-breakpoint
CREATE INDEX "finance_transactions_account_id_sort_order_idx" ON "chhanchhan"."finance_transactions" USING btree ("account_id","sort_order");