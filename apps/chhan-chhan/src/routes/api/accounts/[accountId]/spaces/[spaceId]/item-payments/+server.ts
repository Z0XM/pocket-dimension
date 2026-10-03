import { error, json } from "@sveltejs/kit";
import { canEdit, getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { createSpaceItemPayment, listSpaceItemPayments } from "$lib/server/finance";
import { readJsonBody } from "$lib/server/http";
import { createSpaceItemPaymentSchema } from "$lib/validation/finance";

export async function GET({ locals, params }) {
  const user = requireUser(locals);
  await getMembershipOrThrow(user.id, params.accountId);

  const payments = await listSpaceItemPayments(params.accountId, params.spaceId);
  if (!payments) throw error(404, "Space not found");

  return json({ payments });
}

export async function POST({ locals, params, request }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const payload = await readJsonBody(request, createSpaceItemPaymentSchema);
  const payment = await createSpaceItemPayment(user.id, params.accountId, params.spaceId, payload);
  if (!payment) {
    throw error(400, "Payment exceeds open txn, share, or item remainder");
  }

  return json({ payment }, { status: 201 });
}
