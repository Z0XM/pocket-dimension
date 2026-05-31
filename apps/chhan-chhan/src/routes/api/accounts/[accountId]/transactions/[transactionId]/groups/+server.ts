import { error, json } from "@sveltejs/kit";
import { canEdit, getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { attachTransactionGroup } from "$lib/server/finance";
import { readJsonBody } from "$lib/server/http";
import { attachTransactionGroupSchema } from "$lib/validation/finance";

export async function POST({ locals, params, request }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const payload = await readJsonBody(request, attachTransactionGroupSchema);
  const group = await attachTransactionGroup(params.accountId, params.transactionId, payload.groupId);
  if (!group) throw error(404, "Transaction or group not found");

  return json({ group });
}
