import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { retryFailedImportItem } from "$lib/server/import-jobs";

export const POST: RequestHandler = async ({ locals, params }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");

  const itemId = params.itemId?.trim();
  if (!itemId) throw error(400, "itemId required");

  const result = await retryFailedImportItem(itemId, locals.user.id);
  if (!result.ok) throw error(400, result.message);
  return json({ ok: true });
};
