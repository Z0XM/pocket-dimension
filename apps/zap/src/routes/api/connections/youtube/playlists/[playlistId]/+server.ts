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

  const body = (await request.json().catch(() => ({}))) as {
    autoSync?: boolean;
    hidden?: boolean;
    title?: string;
  };
  const hasAutoSync = typeof body.autoSync === "boolean";
  const hasHidden = typeof body.hidden === "boolean";
  if (!hasAutoSync && !hasHidden) throw error(400, "autoSync or hidden boolean required");

  let title = typeof body.title === "string" ? body.title : null;
  if (!title && hasAutoSync) {
    const playlists = await listYouTubePlaylists(locals.user.id).catch(() => []);
    title = playlists.find((p) => p.id === playlistId)?.title ?? null;
  }

  const pref = await upsertPlaylistPref({
    userId: locals.user.id,
    youtubePlaylistId: playlistId,
    ...(title ? { title } : {}),
    ...(hasAutoSync ? { autoSync: body.autoSync } : {}),
    ...(hasHidden ? { hidden: body.hidden } : {}),
  });

  if (hasAutoSync) {
    await logConnectionActivity({
      userId: locals.user.id,
      provider: "youtube",
      kind: body.autoSync ? "auto_sync_on" : "auto_sync_off",
      summary: body.autoSync
        ? `Enabled auto-sync for “${pref.title ?? playlistId}”`
        : `Disabled auto-sync for “${pref.title ?? playlistId}”`,
      meta: { playlistId },
    });
  }
  if (hasHidden) {
    await logConnectionActivity({
      userId: locals.user.id,
      provider: "youtube",
      kind: body.hidden ? "playlist_hidden" : "playlist_unhidden",
      summary: body.hidden
        ? `Hid “${pref.title ?? playlistId}” from the playlist list`
        : `Unhid “${pref.title ?? playlistId}”`,
      meta: { playlistId },
    });
  }

  return json({
    playlistId,
    autoSync: pref.autoSync,
    hidden: pref.hidden,
    importStatus: pref.importStatus,
    alreadyImported: pref.alreadyImported,
    title: pref.title,
    lastSyncedAt: pref.lastSyncedAt?.toISOString() ?? null,
  });
};
