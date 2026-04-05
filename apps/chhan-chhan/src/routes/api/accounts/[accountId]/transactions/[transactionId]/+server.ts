import { error, json } from "@sveltejs/kit";
import { canEdit, getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { deleteTransaction, updateTransaction } from "$lib/server/finance";
import { readJsonBody } from "$lib/server/http";
import { transactionUpsertSchema } from "$lib/validation/finance";

export async function PATCH({ locals, params, request }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const payload = await readJsonBody(request, transactionUpsertSchema.partial());
  const transaction = await updateTransaction(user.id, params.accountId, params.transactionId, payload);
  if (!transaction) throw error(404, "Transaction not found");
  return json({ transaction });
}

export async function DELETE({ locals, params }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const ok = await deleteTransaction(params.accountId, params.transactionId);
  if (!ok) throw error(404, "Transaction not found");
  return json({ ok: true });
}
