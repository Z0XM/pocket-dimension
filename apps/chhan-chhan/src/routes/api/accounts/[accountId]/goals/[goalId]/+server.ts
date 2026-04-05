import { error, json } from "@sveltejs/kit";
import { canEdit, getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { upsertGoal } from "$lib/server/finance";
import { readJsonBody } from "$lib/server/http";
import { goalUpsertSchema } from "$lib/validation/finance";

export async function PATCH({ locals, params, request }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const payload = await readJsonBody(request, goalUpsertSchema);
  const goal = await upsertGoal(user.id, params.accountId, payload, params.goalId);
  if (!goal) throw error(404, "Goal not found");
  return json({ goal });
}
