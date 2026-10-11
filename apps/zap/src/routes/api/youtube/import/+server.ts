import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getYoutubeLinkStatus, importConnectedPlaylists } from "$lib/server/youtube";
import { isStorageConfigured } from "$lib/server/storage";
import { resolveYtDlpBin } from "$lib/server/ingest";

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");

  const status = await getYoutubeLinkStatus(locals.user.id);
  if (!status.linked) throw error(403, "Connect YouTube first");
  if (!isStorageConfigured()) throw error(503, "Object storage is not configured");
  if (!(await resolveYtDlpBin())) throw error(503, "yt-dlp is not installed");

  const body = (await request.json().catch(() => ({}))) as { playlistIds?: string[] };
  const playlistIds = body.playlistIds ?? [];
  if (!Array.isArray(playlistIds) || playlistIds.length === 0) {
    throw error(400, "playlistIds required");
  }

  try {
    const result = await importConnectedPlaylists(locals.user.id, playlistIds);
    return json(result);
  } catch (err) {
    console.error("[zap youtube import]", err);
    throw error(502, err instanceof Error ? err.message : "Import failed");
  }
};
