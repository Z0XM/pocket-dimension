import { error, json } from "@sveltejs/kit";
import { canEdit, getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { detachRefundLink } from "$lib/server/finance";

export async function DELETE({ locals, params }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const ok = await detachRefundLink(params.accountId, params.transactionId, params.expenseTransactionId);
  if (!ok) throw error(404, "Refund link not found");

  return json({ ok: true });
}
