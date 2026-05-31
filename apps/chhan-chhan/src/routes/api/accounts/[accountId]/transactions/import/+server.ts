import { error, json } from "@sveltejs/kit";
import { canEdit, getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { getAccountCurrency } from "$lib/server/finance";
import { importTransactionRows } from "$lib/server/import";
import { getImporter, listImporters } from "$lib/importers";

export async function GET() {
  return json({
    importers: listImporters().map(({ id, label }) => ({ id, label })),
  });
}

export async function POST({ locals, params, request }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const body = await request.formData();
  const file = body.get("file");
  if (!(file instanceof File)) {
    throw error(400, "Statement file is required as multipart field named 'file'");
  }

  const importerId = String(body.get("importer") ?? "kotak");
  const skipDuplicates = body.get("skipDuplicates") !== "false";

  let parsed;
  try {
    const importer = getImporter(importerId);
    parsed = await importer.parse({
      fileName: file.name,
      mimeType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
  } catch (cause) {
    throw error(400, cause instanceof Error ? cause.message : "Failed to parse statement");
  }

  if (!parsed.rows.length) {
    throw error(400, "No transactions found in statement");
  }

  const currencyCode = await getAccountCurrency(params.accountId);
  const result = await importTransactionRows(user.id, params.accountId, parsed.rows, {
    skipDuplicates,
    currencyCode,
  });

  return json({
    ...result,
    metadata: parsed.metadata,
    importer: importerId,
  });
}
