import { db, schema } from "@pocket-dimension/db";
import { asc, eq, inArray } from "drizzle-orm";
import { getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { toCsv } from "$lib/server/csv";

const COLUMNS = ["occurredOn", "amountMinor", "type", "merchant", "notes", "tags", "spaces"];

export async function GET({ locals, params }) {
  const user = requireUser(locals);
  await getMembershipOrThrow(user.id, params.accountId);

  const rows = await db
    .select({
      id: schema.financeTransactions.id,
      occurredOn: schema.financeTransactions.occurredOn,
      amountMinor: schema.financeTransactions.amountMinor,
      type: schema.financeTransactions.type,
      merchant: schema.financeTransactions.merchant,
      notes: schema.financeTransactions.notes,
    })
    .from(schema.financeTransactions)
    .where(eq(schema.financeTransactions.accountId, params.accountId))
    .orderBy(schema.financeTransactions.occurredOn, schema.financeTransactions.id);

  const tagsByTransaction = new Map<string, string[]>();
  const spacesByTransaction = new Map<string, string[]>();

  if (rows.length) {
    const transactionIds = rows.map((row) => row.id);
    const [tagRows, spaceRows] = await Promise.all([
      db
        .select({ transactionId: schema.financeTransactionTags.transactionId, name: schema.financeTags.name })
        .from(schema.financeTransactionTags)
        .innerJoin(schema.financeTags, eq(schema.financeTags.id, schema.financeTransactionTags.tagId))
        .where(inArray(schema.financeTransactionTags.transactionId, transactionIds))
        .orderBy(asc(schema.financeTags.name)),
      db
        .select({ transactionId: schema.financeSpaceTransactions.transactionId, name: schema.financeSpaces.name })
        .from(schema.financeSpaceTransactions)
        .innerJoin(schema.financeSpaces, eq(schema.financeSpaces.id, schema.financeSpaceTransactions.spaceId))
        .where(inArray(schema.financeSpaceTransactions.transactionId, transactionIds))
        .orderBy(asc(schema.financeSpaces.name)),
    ]);

    for (const row of tagRows) {
      const names = tagsByTransaction.get(row.transactionId) ?? [];
      names.push(row.name);
      tagsByTransaction.set(row.transactionId, names);
    }
    for (const row of spaceRows) {
      const names = spacesByTransaction.get(row.transactionId) ?? [];
      names.push(row.name);
      spacesByTransaction.set(row.transactionId, names);
    }
  }

  const csv = toCsv(
    rows.map((row) => ({
      occurredOn: row.occurredOn,
      amountMinor: String(row.amountMinor),
      type: row.type,
      merchant: row.merchant ?? "",
      notes: row.notes ?? "",
      tags: (tagsByTransaction.get(row.id) ?? []).join("; "),
      spaces: (spacesByTransaction.get(row.id) ?? []).join("; "),
    })),
    COLUMNS
  );

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="transactions-${params.accountId}.csv"`,
    },
  });
}
