import { error, json } from "@sveltejs/kit";
import { canEdit, getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { detachTransactionGroup } from "$lib/server/finance";

/** @deprecated Group hide was removed from the product; PATCH is kept only to fail closed. */
export async function PATCH() {
  throw error(410, "Hiding transactions within a group is no longer supported");
}

export async function DELETE({ locals, params }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const ok = await detachTransactionGroup(params.accountId, params.transactionId, params.groupId);
  if (!ok) throw error(404, "Transaction group link not found");

  return json({ ok: true });
}
