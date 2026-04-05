import { error, json } from "@sveltejs/kit";
import { canEdit, getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { createTransaction, listTransactions } from "$lib/server/finance";
import { parseSearch, readJsonBody } from "$lib/server/http";
import { transactionUpsertSchema, transactionsQuerySchema } from "$lib/validation/finance";

export async function GET({ locals, params, url }) {
  const user = requireUser(locals);
  await getMembershipOrThrow(user.id, params.accountId);
  const query = parseSearch(url, transactionsQuerySchema);
  const page = await listTransactions(params.accountId, query);
  return json(page);
}

export async function POST({ locals, params, request }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const payload = await readJsonBody(request, transactionUpsertSchema);
  const transaction = await createTransaction(user.id, params.accountId, payload);
  return json({ transaction }, { status: 201 });
}
