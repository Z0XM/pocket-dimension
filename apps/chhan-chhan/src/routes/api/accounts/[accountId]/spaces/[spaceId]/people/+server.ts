import { error, json } from "@sveltejs/kit";
import { canEdit, getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { createSpacePerson, listSpacePeople } from "$lib/server/finance";
import { readJsonBody } from "$lib/server/http";
import { createSpacePersonSchema } from "$lib/validation/finance";

export async function GET({ locals, params }) {
  const user = requireUser(locals);
  await getMembershipOrThrow(user.id, params.accountId);

  const people = await listSpacePeople(params.accountId, params.spaceId);
  if (!people) throw error(404, "Space not found");

  return json({ people });
}

export async function POST({ locals, params, request }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const payload = await readJsonBody(request, createSpacePersonSchema);
  const person = await createSpacePerson(user.id, params.accountId, params.spaceId, payload);
  if (!person) throw error(400, "Could not create person");

  return json({ person }, { status: 201 });
}
