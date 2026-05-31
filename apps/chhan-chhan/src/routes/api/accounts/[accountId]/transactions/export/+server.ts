import { db, schema } from "@pocket-dimension/db";
import { and, eq } from "drizzle-orm";
import { error } from "@sveltejs/kit";
import { getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { toCsv } from "$lib/server/csv";

export async function GET({ locals, params }) {
  const user = requireUser(locals);
  await getMembershipOrThrow(user.id, params.accountId);

  const rows = await db
    .select({
      occurredOn: schema.financeTransactions.occurredOn,
      amountMinor: schema.financeTransactions.amountMinor,
      type: schema.financeTransactions.type,
      merchant: schema.financeTransactions.merchant,
      notes: schema.financeTransactions.notes,
      categoryName: schema.financeCategories.name,
    })
    .from(schema.financeTransactions)
    .leftJoin(schema.financeCategories, eq(schema.financeCategories.id, schema.financeTransactions.categoryId))
    .where(and(eq(schema.financeTransactions.accountId, params.accountId)))
    .orderBy(schema.financeTransactions.occurredOn, schema.financeTransactions.id);

  if (!rows.length) {
    const csv = toCsv([], ["occurredOn", "amountMinor", "type", "merchant", "notes", "categoryName"]);
    return new Response(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="transactions-${params.accountId}.csv"`,
      },
    });
  }

  const csv = toCsv(
    rows.map((row) => ({
      occurredOn: row.occurredOn,
      amountMinor: String(row.amountMinor),
      type: row.type,
      merchant: row.merchant ?? "",
      notes: row.notes ?? "",
      categoryName: row.categoryName ?? "",
    })),
    ["occurredOn", "amountMinor", "type", "merchant", "notes", "categoryName"]
  );

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="transactions-${params.accountId}.csv"`,
    },
  });
}
