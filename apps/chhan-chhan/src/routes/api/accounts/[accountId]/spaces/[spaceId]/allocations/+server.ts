import { error, json } from "@sveltejs/kit";
import { canEdit, getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { createSpaceAllocation, createSpaceAllocationsBatch } from "$lib/server/finance";
import { readJsonBody } from "$lib/server/http";
import { createSpaceAllocationSchema, createSpaceAllocationsBatchSchema } from "$lib/validation/finance";

export async function POST({ locals, params, request }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const raw = await request.json();
  const batchParsed = createSpaceAllocationsBatchSchema.safeParse(raw);
  if (batchParsed.success) {
    const result = await createSpaceAllocationsBatch(user.id, params.accountId, params.spaceId, batchParsed.data.allocations, {
      incomingTransactionIds: batchParsed.data.incomingTransactionIds,
      outgoingTransactionIds: batchParsed.data.outgoingTransactionIds,
      notes: batchParsed.data.notes,
      markInPocket: batchParsed.data.markInPocket,
      markOutPocket: batchParsed.data.markOutPocket,
    });
    if (!result) {
      throw error(400, "Settlement needs valid incoming↔outgoing pairs in this space within open remainders");
    }
    return json({ allocations: result.allocations, batch: result.batch, pockets: result.pockets }, { status: 201 });
  }

  const singleParsed = createSpaceAllocationSchema.safeParse(raw);
  if (!singleParsed.success) {
    throw error(400, "Invalid allocation payload");
  }

  const allocation = await createSpaceAllocation(user.id, params.accountId, params.spaceId, singleParsed.data);
  if (!allocation) {
    throw error(400, "Allocation needs two different transactions already in this space and a positive amount");
  }

  return json({ allocation }, { status: 201 });
}
