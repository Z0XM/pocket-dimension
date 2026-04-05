import { error, json } from "@sveltejs/kit";
import { canEdit, getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { listGoals, upsertGoal } from "$lib/server/finance";
import { readJsonBody } from "$lib/server/http";
import { goalUpsertSchema } from "$lib/validation/finance";

export async function GET({ locals, params }) {
  const user = requireUser(locals);
  await getMembershipOrThrow(user.id, params.accountId);
  const goals = await listGoals(params.accountId);
  return json({ goals });
}

export async function POST({ locals, params, request }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const payload = await readJsonBody(request, goalUpsertSchema);
  const goal = await upsertGoal(user.id, params.accountId, payload);
  return json({ goal }, { status: 201 });
}
