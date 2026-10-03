import { error, json } from "@sveltejs/kit";
import { canEdit, getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { createSpaceAllocation } from "$lib/server/finance";
import { readJsonBody } from "$lib/server/http";
import { createSpaceAllocationSchema } from "$lib/validation/finance";

export async function POST({ locals, params, request }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const payload = await readJsonBody(request, createSpaceAllocationSchema);
  const allocation = await createSpaceAllocation(user.id, params.accountId, params.spaceId, payload);
  if (!allocation) {
    throw error(400, "Allocation needs two different transactions already in this space and a positive amount");
  }

  return json({ allocation }, { status: 201 });
}
