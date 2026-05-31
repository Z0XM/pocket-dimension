import { error, json } from "@sveltejs/kit";
import { canEdit, getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { attachTransactionTag } from "$lib/server/finance";
import { readJsonBody } from "$lib/server/http";
import { attachTransactionTagSchema } from "$lib/validation/finance";

export async function POST({ locals, params, request }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const payload = await readJsonBody(request, attachTransactionTagSchema);
  const tag = await attachTransactionTag(params.accountId, params.transactionId, payload.tagId);
  if (!tag) throw error(404, "Transaction or tag not found");

  return json({ tag });
}
