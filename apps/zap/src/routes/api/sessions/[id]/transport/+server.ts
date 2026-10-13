import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { SessionError, onTrackEnded, pause, play, seek, skip } from "$lib/server/sessions";

export const POST: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");

  try {
    const body = (await request.json()) as { action?: string; positionMs?: number };
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
        snapshot = await skip(id, uid);
        break;
      case "seek":
        snapshot = await seek(id, uid, Number(body.positionMs));
        break;
      case "ended":
        snapshot = await onTrackEnded(id, uid);
        break;
      default:
        throw error(400, "action must be play|pause|skip|seek|ended");
    }
    return json(snapshot);
  } catch (err) {
    if (err instanceof SessionError) throw error(err.status, err.message);
    throw err;
  }
};
