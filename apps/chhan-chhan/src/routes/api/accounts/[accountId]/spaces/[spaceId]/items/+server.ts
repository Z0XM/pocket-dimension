import { error, json } from "@sveltejs/kit";
import { canEdit, getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { createSpaceItem, listSpaceItems } from "$lib/server/finance";
import { readJsonBody } from "$lib/server/http";
import { createSpaceItemSchema } from "$lib/validation/finance";

export async function GET({ locals, params }) {
  const user = requireUser(locals);
  await getMembershipOrThrow(user.id, params.accountId);

  const items = await listSpaceItems(params.accountId, params.spaceId);
  if (!items) throw error(404, "Space not found");

  return json({ items });
}

export async function POST({ locals, params, request }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const payload = await readJsonBody(request, createSpaceItemSchema);
  const item = await createSpaceItem(user.id, params.accountId, params.spaceId, payload);
  if (!item) throw error(400, "Shares must cover people in this space and sum to the item amount");

  return json({ item }, { status: 201 });
}
