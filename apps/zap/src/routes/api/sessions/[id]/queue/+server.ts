import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { SessionError, clearQueue, enqueueCatalogueTrack, moveQueueItem, removeQueueItem } from "$lib/server/sessions";

export const POST: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");

  try {
    const body = (await request.json()) as {
      mediaAssetId?: string;
      action?: string;
      queueItemId?: string;
      direction?: "up" | "down";
    };
    const id = params.id!;
    const uid = locals.user.id;

    if (body.action === "clear") {
      return json(await clearQueue(id, uid));
    }
    if (body.action === "remove") {
      if (!body.queueItemId?.trim()) throw error(400, "queueItemId required");
      return json(await removeQueueItem(id, uid, body.queueItemId.trim()));
    }
    if (body.action === "move") {
      if (!body.queueItemId?.trim()) throw error(400, "queueItemId required");
      if (body.direction !== "up" && body.direction !== "down") throw error(400, "direction must be up|down");
      return json(await moveQueueItem(id, uid, body.queueItemId.trim(), body.direction));
    }

    if (!body.mediaAssetId?.trim()) throw error(400, "mediaAssetId required");
    const snapshot = await enqueueCatalogueTrack(id, uid, body.mediaAssetId.trim());
    return json(snapshot);
  } catch (err) {
    if (err instanceof SessionError) throw error(err.status, err.message);
    throw err;
  }
};
