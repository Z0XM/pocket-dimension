import { error, json } from "@sveltejs/kit";
import { canEdit, getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { createSpace, listSpaces } from "$lib/server/finance";
import { readJsonBody } from "$lib/server/http";
import { createSpaceSchema } from "$lib/validation/finance";

export async function GET({ locals, params }) {
  const user = requireUser(locals);
  await getMembershipOrThrow(user.id, params.accountId);
  const spaces = await listSpaces(params.accountId);
  return json({ spaces });
}

export async function POST({ locals, params, request }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const payload = await readJsonBody(request, createSpaceSchema);
  const space = await createSpace(user.id, params.accountId, payload);
  if (!space) throw error(409, "A space with that name already exists");

  return json({ space }, { status: 201 });
}
