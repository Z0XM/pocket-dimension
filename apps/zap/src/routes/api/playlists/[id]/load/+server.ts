import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { PlaylistError, loadPlaylistIntoSession } from "$lib/server/playlists";

export const POST: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");

  try {
    const body = (await request.json()) as { sessionId?: string };
    if (!body.sessionId) throw error(400, "sessionId required");
    const snapshot = await loadPlaylistIntoSession(body.sessionId, locals.user.id, params.id!);
    return json(snapshot);
  } catch (err) {
    if (err instanceof PlaylistError) throw error(err.status, err.message);
    throw err;
  }
};
