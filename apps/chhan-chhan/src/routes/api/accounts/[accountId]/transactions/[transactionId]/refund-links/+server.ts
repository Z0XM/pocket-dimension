import { error, json } from "@sveltejs/kit";
import { canEdit, getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { attachRefundLink } from "$lib/server/finance";
import { readJsonBody } from "$lib/server/http";
import { attachRefundLinkSchema } from "$lib/validation/finance";

export async function POST({ locals, params, request }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const payload = await readJsonBody(request, attachRefundLinkSchema);
  const peer = await attachRefundLink(params.accountId, params.transactionId, payload.expenseTransactionId);
  if (!peer) throw error(404, "Refund or expense transaction not found");

  return json({ peer });
}
