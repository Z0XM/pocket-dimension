import { error, json } from "@sveltejs/kit";
import { canEdit, getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { listBudgets, upsertBudget } from "$lib/server/finance";
import { readJsonBody } from "$lib/server/http";
import { budgetUpsertSchema } from "$lib/validation/finance";

export async function GET({ locals, params }) {
  const user = requireUser(locals);
  await getMembershipOrThrow(user.id, params.accountId);
  const budgets = await listBudgets(params.accountId);
  return json({ budgets });
}

export async function POST({ locals, params, request }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const payload = await readJsonBody(request, budgetUpsertSchema);
  const budget = await upsertBudget(user.id, params.accountId, payload);
  return json({ budget }, { status: 201 });
}
