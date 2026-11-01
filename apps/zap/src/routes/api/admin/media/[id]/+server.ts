import { error, json } from "@sveltejs/kit";
import { isUuid } from "$lib/admin-access";
import { requireZapAdmin } from "$lib/server/admin/access";
import { archiveMediaAsset, deleteMediaAsset, unarchiveMediaAsset } from "$lib/server/admin/media";
import type { RequestHandler } from "./$types";

/** Zap admin: delete a song from the catalogue, every DB reference, and its R2/S3 object. */
export const DELETE: RequestHandler = async ({ locals, params }) => {
  const admin = requireZapAdmin(locals);
  if (!isUuid(params.id)) throw error(404, "Song not found");
  const result = await deleteMediaAsset(params.id);
  if (!result) throw error(404, "Song not found");
  console.info(
    `[zap admin] ${admin.email} deleted media ${result.id} "${result.title}" storage=${result.storageKey ?? "none"} storageDeleted=${result.storageDeleted}`
  );
  return json(result);
};

/** Zap admin: archive (hide) or unarchive a catalogue song. */
export const PATCH: RequestHandler = async ({ locals, params, request }) => {
  const admin = requireZapAdmin(locals);
  if (!isUuid(params.id)) throw error(404, "Song not found");

  const body = (await request.json().catch(() => null)) as { action?: string } | null;
  const action = body?.action;
  if (action !== "archive" && action !== "unarchive") {
    throw error(400, 'Expected { action: "archive" | "unarchive" }');
  }

  if (action === "archive") {
    const result = await archiveMediaAsset(params.id);
    if (!result) throw error(404, "Song not found");
    console.info(`[zap admin] ${admin.email} archived media ${result.id} "${result.title}"`);
    return json(result);
  }

  const result = await unarchiveMediaAsset(params.id);
  if (!result) throw error(404, "Song not found");
  console.info(`[zap admin] ${admin.email} unarchived media ${result.id} "${result.title}" → ${result.status}`);
  return json(result);
};
