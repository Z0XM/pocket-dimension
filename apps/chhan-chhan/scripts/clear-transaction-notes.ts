import { db, schema } from "@pocket-dimension/db";
import { eq, sql } from "drizzle-orm";

const accountId = process.argv[2];

if (!accountId) {
  console.error("Usage: bun scripts/clear-transaction-notes.ts <account-id>");
  process.exit(1);
}

const account = await db.query.financeAccounts.findFirst({
  where: eq(schema.financeAccounts.id, accountId),
  columns: { id: true, name: true },
});

if (!account) {
  console.error(`Account not found: ${accountId}`);
  process.exit(1);
}

const result = await db.execute(sql`
  update chhanchhan.finance_transactions
  set notes = null, updated_at = now()
  where account_id = ${accountId}
    and notes is not null
    and notes <> ''
`);

const cleared = Number((result as { rowCount?: number }).rowCount ?? 0);
console.log(`Cleared notes on ${cleared} transactions for ${account.name}.`);
