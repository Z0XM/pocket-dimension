import { error, json } from "@sveltejs/kit";
import { canEdit, getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { deleteSpaceAllocation, updateSpaceAllocation } from "$lib/server/finance";
import { readJsonBody } from "$lib/server/http";
import { updateSpaceAllocationSchema } from "$lib/validation/finance";

export async function PATCH({ locals, params, request }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const payload = await readJsonBody(request, updateSpaceAllocationSchema);
  const allocation = await updateSpaceAllocation(user.id, params.accountId, params.spaceId, params.allocationId, payload.amountMinor);
  if (!allocation) throw error(404, "Allocation not found");

  return json({ allocation });
}

export async function DELETE({ locals, params }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const ok = await deleteSpaceAllocation(params.accountId, params.spaceId, params.allocationId);
  if (!ok) throw error(404, "Allocation not found");

  return json({ ok: true });
}
