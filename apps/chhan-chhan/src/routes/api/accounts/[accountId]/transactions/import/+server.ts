import { db, schema } from "@pocket-dimension/db";
import { and, eq } from "drizzle-orm";
import { error, json } from "@sveltejs/kit";
import { canEdit, getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { parseCsv } from "$lib/server/csv";
import { csvImportRowSchema } from "$lib/validation/finance";

export async function POST({ locals, params, request }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const body = await request.formData();
  const file = body.get("file");
  if (!(file instanceof File)) {
    throw error(400, "CSV file is required as multipart field named 'file'");
  }

  const autoCreateCategories = body.get("autoCreateCategories") === "true";
  const { rows } = parseCsv(await file.text());
  if (!rows.length) throw error(400, "No CSV rows found");

  const existingCategories = await db
    .select({ id: schema.financeCategories.id, name: schema.financeCategories.name })
    .from(schema.financeCategories)
    .where(eq(schema.financeCategories.accountId, params.accountId));

  const categoryMap = new Map(existingCategories.map((row) => [row.name.toLowerCase(), row.id]));
  let accepted = 0;
  let rejected = 0;
  const rejectionReasons: Array<{ row: number; reason: string }> = [];

  for (const [index, row] of rows.entries()) {
    const parsed = csvImportRowSchema.safeParse({
      occurredOn: row.occurredOn,
      amountMinor: Number(row.amountMinor),
      type: row.type,
      merchant: row.merchant,
      notes: row.notes,
      categoryName: row.categoryName,
    });

    if (!parsed.success) {
      rejected += 1;
      rejectionReasons.push({ row: index + 2, reason: parsed.error.issues[0]?.message ?? "Invalid row" });
      continue;
    }

    let categoryId: string | undefined;
    const normalizedCategory = parsed.data.categoryName?.trim().toLowerCase();
    if (normalizedCategory) {
      categoryId = categoryMap.get(normalizedCategory);

      if (!categoryId && autoCreateCategories) {
        const [newCategory] = await db
          .insert(schema.financeCategories)
          .values({
            accountId: params.accountId,
            name: parsed.data.categoryName!.trim(),
            kind: parsed.data.type,
            createdById: user.id,
            updatedById: user.id,
          })
          .onConflictDoNothing()
          .returning({ id: schema.financeCategories.id });

        if (newCategory?.id) {
          categoryId = newCategory.id;
          categoryMap.set(normalizedCategory, newCategory.id);
        }
      }
    }

    await db.insert(schema.financeTransactions).values({
      accountId: params.accountId,
      categoryId,
      occurredOn: parsed.data.occurredOn,
      amountMinor: parsed.data.amountMinor,
      currencyCode: "USD",
      type: parsed.data.type,
      merchant: parsed.data.merchant,
      notes: parsed.data.notes,
      createdById: user.id,
      updatedById: user.id,
    });
    accepted += 1;
  }

  return json({
    totalRows: rows.length,
    accepted,
    rejected,
    rejectionReasons,
    autoCreateCategories,
  });
}
