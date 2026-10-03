import { error, json } from "@sveltejs/kit";
import { canEdit, getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { attachTransactionSpace } from "$lib/server/finance";
import { readJsonBody } from "$lib/server/http";
import { attachTransactionSpaceSchema } from "$lib/validation/finance";

export async function POST({ locals, params, request }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const payload = await readJsonBody(request, attachTransactionSpaceSchema);
  const space = await attachTransactionSpace(params.accountId, params.transactionId, payload.spaceId);
  if (!space) throw error(404, "Transaction or space not found");

  return json({ space });
}
