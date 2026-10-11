import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { SessionError, enqueueCatalogueTrack } from "$lib/server/sessions";

export const POST: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");

  try {
    const body = (await request.json()) as { mediaAssetId?: string };
    if (!body.mediaAssetId?.trim()) throw error(400, "mediaAssetId required");
    const snapshot = await enqueueCatalogueTrack(params.id!, locals.user.id, body.mediaAssetId.trim());
    return json(snapshot);
  } catch (err) {
    if (err instanceof SessionError) throw error(err.status, err.message);
    throw err;
  }
};
