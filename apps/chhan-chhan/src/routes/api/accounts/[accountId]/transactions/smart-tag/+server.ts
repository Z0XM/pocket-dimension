import { error, json } from "@sveltejs/kit";
import { canEdit, getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { applySmartTagging, previewSmartTagging } from "$lib/server/finance";
import { readJsonBody } from "$lib/server/http";
import { smartTagApplySchema, smartTagPreviewSchema } from "$lib/validation/finance";

export async function GET({ locals, params, url }) {
  const user = requireUser(locals);
  await getMembershipOrThrow(user.id, params.accountId);

  const parsed = smartTagPreviewSchema.safeParse({
    merchant: url.searchParams.get("merchant"),
    newTagId: url.searchParams.get("newTagId"),
    sourceTransactionId: url.searchParams.get("sourceTransactionId"),
    type: url.searchParams.get("type"),
  });

  if (!parsed.success) {
    throw error(400, parsed.error.issues[0]?.message ?? "Invalid preview request");
  }

  const preview = await previewSmartTagging(params.accountId, parsed.data);

  return json({ preview });
}

export async function POST({ locals, params, request }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const payload = await readJsonBody(request, smartTagApplySchema);
  const result = await applySmartTagging(user.id, params.accountId, {
    sourceTransactionId: payload.sourceTransactionId,
    newTagId: payload.newTagId,
    type: payload.type,
    mode: payload.mode,
    migrations: payload.migrations.map((migration) => ({
      merchant: migration.merchant,
      fromTagIds: migration.fromTagIds,
      enabled: migration.enabled,
    })),
  });

  return json(result);
}
