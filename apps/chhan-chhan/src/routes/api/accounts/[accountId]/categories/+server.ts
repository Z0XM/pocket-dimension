import { error, json } from "@sveltejs/kit";
import { canEdit, getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { createCategory, listCategories } from "$lib/server/finance";
import { readJsonBody } from "$lib/server/http";
import { createCategorySchema } from "$lib/validation/finance";

export async function GET({ locals, params }) {
  const user = requireUser(locals);
  await getMembershipOrThrow(user.id, params.accountId);
  const categories = await listCategories(params.accountId);
  return json({ categories });
}

export async function POST({ locals, params, request }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const payload = await readJsonBody(request, createCategorySchema);
  const category = await createCategory(user.id, params.accountId, payload);
  if (!category) {
    throw error(409, "Category already exists");
  }
  return json({ category }, { status: 201 });
}
