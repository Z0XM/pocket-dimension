import { readFileSync } from "node:fs";
import { db, schema } from "@pocket-dimension/db";
import { eq } from "drizzle-orm";
import { kotakImporter } from "../src/lib/importers/kotak.ts";
import { dedupeAccountTransactions, importTransactionRows, resetAccountTransactions } from "../src/lib/server/import.ts";

const accountId = process.argv[2];
const pdfPath = process.argv[3];
const reset = process.argv.includes("--reset");

if (!accountId) {
  console.error("Usage: bun scripts/dedupe-transactions.ts <account-id> [statement.pdf] [--reset]");
  process.exit(1);
}

const account = await db.query.financeAccounts.findFirst({
  where: eq(schema.financeAccounts.id, accountId),
  columns: { id: true, name: true, ownerUserId: true },
});

if (!account) {
  console.error(`Account not found: ${accountId}`);
  process.exit(1);
}

if (reset) {
  const removed = await resetAccountTransactions(accountId);
  console.log(`Reset ${account.name}: deleted ${removed} transactions.`);
}

if (!reset) {
  console.log(`Deduping transactions for ${account.name} (${accountId})...`);
  const { deleted, remaining } = await dedupeAccountTransactions(accountId);
  console.log(`Removed ${deleted} duplicate rows. ${remaining} transactions remain.`);
}

if (pdfPath) {
  console.log(`${reset ? "Importing" : "Backfilling"} from ${pdfPath}...`);
  const bytes = new Uint8Array(readFileSync(pdfPath));
  const { rows } = await kotakImporter.parse({
    bytes,
    fileName: pdfPath.split("/").pop() ?? "statement.pdf",
    mimeType: "application/pdf",
  });
  const result = await importTransactionRows(account.ownerUserId, accountId, rows, {
    skipDuplicates: !reset,
  });
  console.log(`Import: ${result.accepted} accepted, ${result.skipped} skipped, ${result.rejected} rejected (${rows.length} parsed).`);
}

process.exit(0);
