import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getYoutubeLinkStatus } from "$lib/server/youtube";
import { connectYoutubePlaylist, parseSyncInterval, parseSyncMode } from "$lib/server/connections";

export const POST: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");

  const status = await getYoutubeLinkStatus(locals.user.id);
  if (!status.linked) throw error(403, "Connect YouTube first");

  const playlistId = params.playlistId?.trim();
  if (!playlistId) throw error(400, "playlistId required");

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    syncMode?: string;
    syncInterval?: string;
  };
  const syncMode = body.syncMode !== undefined ? parseSyncMode(body.syncMode) : undefined;
  const syncInterval = body.syncInterval !== undefined ? parseSyncInterval(body.syncInterval) : undefined;
  if (body.syncMode !== undefined && !syncMode) throw error(400, "syncMode must be additive or exact");
  if (body.syncInterval !== undefined && !syncInterval) throw error(400, "invalid syncInterval");

  try {
    const result = await connectYoutubePlaylist(locals.user.id, playlistId, {
      title: typeof body.title === "string" ? body.title : null,
      ...(syncMode ? { syncMode } : {}),
      ...(syncInterval ? { syncInterval } : {}),
    });
    return json(result, { status: result.jobId ? 202 : 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connect failed";
    throw error(400, message);
  }
};
