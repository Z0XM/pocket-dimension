CREATE TABLE "chhanchhan"."finance_tags" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color_hex" text,
	CONSTRAINT "finance_tags_account_id_name_unique" UNIQUE("account_id","name")
);
--> statement-breakpoint
CREATE TABLE "chhanchhan"."finance_transaction_tags" (
	"transaction_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "finance_transaction_tags_transaction_id_tag_id_pk" PRIMARY KEY("transaction_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_tags" ADD CONSTRAINT "finance_tags_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_tags" ADD CONSTRAINT "finance_tags_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_tags" ADD CONSTRAINT "finance_tags_account_id_finance_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "chhanchhan"."finance_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_transaction_tags" ADD CONSTRAINT "finance_transaction_tags_transaction_id_finance_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "chhanchhan"."finance_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_transaction_tags" ADD CONSTRAINT "finance_transaction_tags_tag_id_finance_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "chhanchhan"."finance_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "finance_tags_account_id_idx" ON "chhanchhan"."finance_tags" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "finance_transaction_tags_tag_id_idx" ON "chhanchhan"."finance_transaction_tags" USING btree ("tag_id");