import { error, json } from "@sveltejs/kit";
import { canEdit, getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { applySmartCategorization, previewSmartCategorization } from "$lib/server/finance";
import { readJsonBody } from "$lib/server/http";
import { smartCategorizeApplySchema, smartCategorizePreviewSchema } from "$lib/validation/finance";

export async function GET({ locals, params, url }) {
  const user = requireUser(locals);
  await getMembershipOrThrow(user.id, params.accountId);

  const parsed = smartCategorizePreviewSchema.safeParse({
    merchant: url.searchParams.get("merchant"),
    newCategoryId: url.searchParams.get("newCategoryId") || null,
    sourceTransactionId: url.searchParams.get("sourceTransactionId"),
    type: url.searchParams.get("type"),
  });

  if (!parsed.success) {
    throw error(400, parsed.error.issues[0]?.message ?? "Invalid preview request");
  }

  const preview = await previewSmartCategorization(params.accountId, {
    merchant: parsed.data.merchant,
    newCategoryId: parsed.data.newCategoryId ?? null,
    sourceTransactionId: parsed.data.sourceTransactionId,
    type: parsed.data.type,
  });

  return json({ preview });
}

export async function POST({ locals, params, request }) {
  const user = requireUser(locals);
  const membership = await getMembershipOrThrow(user.id, params.accountId);
  if (!canEdit(membership.role)) {
    throw error(403, "You only have read access");
  }

  const payload = await readJsonBody(request, smartCategorizeApplySchema);
  const result = await applySmartCategorization(user.id, params.accountId, {
    sourceTransactionId: payload.sourceTransactionId,
    newCategoryId: payload.newCategoryId ?? null,
    type: payload.type,
    migrations: payload.migrations.map((migration) => ({
      merchant: migration.merchant,
      fromCategoryId: migration.fromCategoryId ?? null,
      enabled: migration.enabled,
    })),
  });

  return json(result);
}
