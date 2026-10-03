-- Drop unused space-transaction actor attribution (idempotent for DBs that already ran 0040 with actor).

ALTER TABLE "chhanchhan"."finance_space_transactions" DROP CONSTRAINT IF EXISTS "finance_space_transactions_actor_person_id_finance_space_people_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "chhanchhan"."finance_space_transactions_actor_person_id_idx";
--> statement-breakpoint
ALTER TABLE "chhanchhan"."finance_space_transactions" DROP COLUMN IF EXISTS "actor_person_id";
