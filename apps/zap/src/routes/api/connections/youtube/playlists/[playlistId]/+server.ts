import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getYoutubeLinkStatus, listYouTubePlaylists } from "$lib/server/youtube";
import { upsertPlaylistPref } from "$lib/server/connections";
import { previewYouTubePlaylist } from "$lib/server/connections/youtube-playlists";
import { logConnectionActivity } from "$lib/server/connections/activity";

export const GET: RequestHandler = async ({ locals, params, url }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");

  const status = await getYoutubeLinkStatus(locals.user.id);
  if (!status.linked) throw error(403, "Connect YouTube first");

  const playlistId = params.playlistId?.trim();
  if (!playlistId) throw error(400, "playlistId required");

  const title = url.searchParams.get("title")?.trim() || undefined;
  const preview = await previewYouTubePlaylist(locals.user.id, playlistId, { title });
  return json({ preview });
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");

  const status = await getYoutubeLinkStatus(locals.user.id);
  if (!status.linked) throw error(403, "Connect YouTube first");

  const playlistId = params.playlistId?.trim();
  if (!playlistId) throw error(400, "playlistId required");

  const body = (await request.json().catch(() => ({}))) as { autoSync?: boolean; title?: string };
  if (typeof body.autoSync !== "boolean") throw error(400, "autoSync boolean required");

  let title = typeof body.title === "string" ? body.title : null;
  if (!title) {
    const playlists = await listYouTubePlaylists(locals.user.id).catch(() => []);
    title = playlists.find((p) => p.id === playlistId)?.title ?? null;
  }

  const pref = await upsertPlaylistPref({
    userId: locals.user.id,
    youtubePlaylistId: playlistId,
    title,
    autoSync: body.autoSync,
  });

  await logConnectionActivity({
    userId: locals.user.id,
    provider: "youtube",
    kind: body.autoSync ? "auto_sync_on" : "auto_sync_off",
    summary: body.autoSync
      ? `Enabled auto-sync for “${title ?? playlistId}”`
      : `Disabled auto-sync for “${title ?? playlistId}”`,
    meta: { playlistId },
  });

  return json({
    playlistId,
    autoSync: pref.autoSync,
    title: pref.title,
    lastSyncedAt: pref.lastSyncedAt?.toISOString() ?? null,
  });
};
