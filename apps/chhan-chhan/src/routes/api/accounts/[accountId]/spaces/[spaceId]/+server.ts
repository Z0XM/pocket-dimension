import { error, json } from "@sveltejs/kit";
import { canEdit, getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { deleteSpace, getSpaceDetail, updateSpace } from "$lib/server/finance";
import { readJsonBody } from "$lib/server/http";
import { updateSpaceSchema } from "$lib/validation/finance";

export async function GET({ locals, params }) {
  const user = requireUser(locals);
  await getMembershipOrThrow(user.id, params.accountId);

  const detail = await getSpaceDetail(params.accountId, params.spaceId);
  if (!detail) throw error(404, "Space not found");

  return json(detail);
}

export async function PATCH({ locals, params, request }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const payload = await readJsonBody(request, updateSpaceSchema.omit({ id: true }));
  const space = await updateSpace(user.id, params.accountId, { ...payload, id: params.spaceId });
  if (!space) throw error(404, "Space not found");

  return json({ space });
}

export async function DELETE({ locals, params }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const ok = await deleteSpace(params.accountId, params.spaceId);
  if (!ok) throw error(404, "Space not found");

  return json({ ok: true });
}
