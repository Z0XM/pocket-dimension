import { error, json } from "@sveltejs/kit";
import { canEdit, getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { deleteSpaceItem, updateSpaceItem } from "$lib/server/finance";
import { readJsonBody } from "$lib/server/http";
import { updateSpaceItemSchema } from "$lib/validation/finance";

export async function PATCH({ locals, params, request }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const payload = await readJsonBody(request, updateSpaceItemSchema);
  const item = await updateSpaceItem(user.id, params.accountId, params.spaceId, params.itemId, payload);
  if (!item) throw error(400, "Item not found or invalid shares");

  return json({ item });
}

export async function DELETE({ locals, params }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const ok = await deleteSpaceItem(params.accountId, params.spaceId, params.itemId);
  if (!ok) throw error(404, "Item not found");

  return json({ ok: true });
}
