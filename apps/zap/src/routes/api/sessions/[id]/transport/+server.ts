import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { SessionError, onTrackEnded, pause, play, playQueueItem, previous, seek, skip } from "$lib/server/sessions";

export const POST: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");

  try {
    const body = (await request.json()) as { action?: string; positionMs?: number; queueItemId?: string };
    const id = params.id!;
    const uid = locals.user.id;
    let snapshot;
    switch (body.action) {
      case "play":
        snapshot = await play(id, uid);
        break;
      case "pause":
        snapshot = await pause(id, uid);
        break;
      case "skip":
      case "next":
        snapshot = await skip(id, uid);
        break;
      case "previous":
        snapshot = await previous(id, uid);
        break;
      case "seek":
        snapshot = await seek(id, uid, Number(body.positionMs));
        break;
      case "playItem":
        if (!body.queueItemId?.trim()) throw error(400, "queueItemId required");
        snapshot = await playQueueItem(id, uid, body.queueItemId.trim());
        break;
      case "ended":
        snapshot = await onTrackEnded(id, uid);
        break;
      default:
        throw error(400, "action must be play|pause|skip|next|previous|seek|playItem|ended");
    }
    return json(snapshot);
  } catch (err) {
    if (err instanceof SessionError) throw error(err.status, err.message);
    throw err;
  }
};
