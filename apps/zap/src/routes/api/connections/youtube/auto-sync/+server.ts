import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getYoutubeLinkStatus } from "$lib/server/youtube";
import { runYouTubeAutoSyncForUser } from "$lib/server/connections";

/**
 * Kick off additive auto-sync without waiting for large playlists to finish.
 * Shell mounts fire-and-forget this; blocking on a ~700-track yt-dlp run caused proxy 502s.
 */
export const POST: RequestHandler = async ({ locals }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");

  const status = await getYoutubeLinkStatus(locals.user.id);
  if (!status.linked) throw error(403, "Connect YouTube first");

  const userId = locals.user.id;
  void runYouTubeAutoSyncForUser(userId).catch((err) => {
    console.warn("[zap youtube auto-sync]", err);
  });

  return json({ accepted: true });
};
