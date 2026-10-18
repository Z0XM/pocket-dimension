import { error, json } from "@sveltejs/kit";
import { isUuid } from "$lib/admin-access";
import { requireZapAdmin } from "$lib/server/admin/access";
import { deleteMediaAsset } from "$lib/server/admin/media";
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
