import { error, json } from "@sveltejs/kit";
import { canEdit, getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { updateAccount } from "$lib/server/finance";
import { readJsonBody } from "$lib/server/http";
import { updateAccountSchema } from "$lib/validation/finance";

export async function PATCH({ locals, params, request }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const payload = await readJsonBody(request, updateAccountSchema);
  const account = await updateAccount(user.id, params.accountId, payload);
  if (!account) {
    throw error(404, "Account not found");
  }

  return json({ account });
}
