import { error, json } from "@sveltejs/kit";
import { canEdit, getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { deleteSpacePerson, updateSpacePerson } from "$lib/server/finance";
import { readJsonBody } from "$lib/server/http";
import { updateSpacePersonSchema } from "$lib/validation/finance";

export async function PATCH({ locals, params, request }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const payload = await readJsonBody(request, updateSpacePersonSchema);
  const person = await updateSpacePerson(user.id, params.accountId, params.spaceId, params.personId, payload);
  if (!person) throw error(404, "Person not found");

  return json({ person });
}

export async function DELETE({ locals, params }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const ok = await deleteSpacePerson(params.accountId, params.spaceId, params.personId);
  if (!ok) throw error(400, "Person not found or cannot delete Me");

  return json({ ok: true });
}
