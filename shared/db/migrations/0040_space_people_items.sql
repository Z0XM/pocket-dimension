-- Full Space mode: people, items/shares, item payments.

CREATE TABLE "chhanchhan"."finance_space_people" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"space_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_self" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chhanchhan"."finance_space_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"space_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "chhanchhan"."finance_space_item_shares" (
	"item_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"share_minor" bigint NOT NULL,
	CONSTRAINT "finance_space_item_shares_item_id_person_id_pk" PRIMARY KEY("item_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "chhanchhan"."finance_space_item_payments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"space_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"covers_person_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_people" ADD CONSTRAINT "finance_space_people_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_people" ADD CONSTRAINT "finance_space_people_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_people" ADD CONSTRAINT "finance_space_people_space_id_finance_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "chhanchhan"."finance_spaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_items" ADD CONSTRAINT "finance_space_items_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_items" ADD CONSTRAINT "finance_space_items_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_items" ADD CONSTRAINT "finance_space_items_space_id_finance_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "chhanchhan"."finance_spaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_item_shares" ADD CONSTRAINT "finance_space_item_shares_item_id_finance_space_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "chhanchhan"."finance_space_items"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_item_shares" ADD CONSTRAINT "finance_space_item_shares_person_id_finance_space_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "chhanchhan"."finance_space_people"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_item_payments" ADD CONSTRAINT "finance_space_item_payments_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_item_payments" ADD CONSTRAINT "finance_space_item_payments_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_item_payments" ADD CONSTRAINT "finance_space_item_payments_space_id_finance_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "chhanchhan"."finance_spaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_item_payments" ADD CONSTRAINT "finance_space_item_payments_item_id_finance_space_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "chhanchhan"."finance_space_items"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_item_payments" ADD CONSTRAINT "finance_space_item_payments_transaction_id_finance_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "chhanchhan"."finance_transactions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_item_payments" ADD CONSTRAINT "finance_space_item_payments_covers_person_id_finance_space_people_id_fk" FOREIGN KEY ("covers_person_id") REFERENCES "chhanchhan"."finance_space_people"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "finance_space_people_space_id_name_unique" ON "chhanchhan"."finance_space_people" USING btree ("space_id","name");
--> statement-breakpoint
CREATE INDEX "finance_space_people_space_id_idx" ON "chhanchhan"."finance_space_people" USING btree ("space_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "finance_space_people_one_self_per_space" ON "chhanchhan"."finance_space_people" USING btree ("space_id") WHERE "is_self" = true;
--> statement-breakpoint
CREATE INDEX "finance_space_items_space_id_idx" ON "chhanchhan"."finance_space_items" USING btree ("space_id");
--> statement-breakpoint
CREATE INDEX "finance_space_item_shares_person_id_idx" ON "chhanchhan"."finance_space_item_shares" USING btree ("person_id");
--> statement-breakpoint
CREATE INDEX "finance_space_item_payments_space_id_idx" ON "chhanchhan"."finance_space_item_payments" USING btree ("space_id");
--> statement-breakpoint
CREATE INDEX "finance_space_item_payments_item_id_idx" ON "chhanchhan"."finance_space_item_payments" USING btree ("item_id");
--> statement-breakpoint
CREATE INDEX "finance_space_item_payments_transaction_id_idx" ON "chhanchhan"."finance_space_item_payments" USING btree ("transaction_id");
--> statement-breakpoint
CREATE INDEX "finance_space_item_payments_covers_person_id_idx" ON "chhanchhan"."finance_space_item_payments" USING btree ("covers_person_id");
