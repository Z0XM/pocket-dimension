import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getYoutubeLinkStatus, listYouTubePlaylists } from "$lib/server/youtube";
import { parseSyncInterval, parseSyncMode, syncIntervalToAutoSync, upsertPlaylistPref } from "$lib/server/connections";
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
    syncMode?: string;
    syncInterval?: string;
  };
  const hasAutoSync = typeof body.autoSync === "boolean";
  const hasHidden = typeof body.hidden === "boolean";
  const syncMode = body.syncMode !== undefined ? parseSyncMode(body.syncMode) : undefined;
  const parsedInterval = body.syncInterval !== undefined ? parseSyncInterval(body.syncInterval) : undefined;
  if (body.syncMode !== undefined && !syncMode) throw error(400, "syncMode must be additive or exact");
  if (body.syncInterval !== undefined && !parsedInterval) throw error(400, "invalid syncInterval");
  if (!hasAutoSync && !hasHidden && syncMode === undefined && parsedInterval === undefined) {
    throw error(400, "autoSync, hidden, syncMode, or syncInterval required");
  }

  let title = typeof body.title === "string" ? body.title : null;
  if (!title && (hasAutoSync || parsedInterval !== undefined)) {
    const playlists = await listYouTubePlaylists(locals.user.id).catch(() => []);
    title = playlists.find((p) => p.id === playlistId)?.title ?? null;
  }

  // Interval drives autoSync; flipping autoSync alone maps to hourly/off for legacy toggles.
  let nextInterval = parsedInterval;
  let nextAutoSync = hasAutoSync ? body.autoSync : undefined;
  if (parsedInterval) {
    nextAutoSync = syncIntervalToAutoSync(parsedInterval);
  } else if (hasAutoSync) {
    nextInterval = body.autoSync ? "hourly" : "off";
    nextAutoSync = body.autoSync;
  }

  const pref = await upsertPlaylistPref({
    userId: locals.user.id,
    youtubePlaylistId: playlistId,
    ...(title ? { title } : {}),
    ...(nextAutoSync !== undefined ? { autoSync: nextAutoSync } : {}),
    ...(hasHidden ? { hidden: body.hidden } : {}),
    ...(syncMode ? { syncMode } : {}),
    ...(nextInterval ? { syncInterval: nextInterval } : {}),
  });

  if (nextAutoSync !== undefined) {
    await logConnectionActivity({
      userId: locals.user.id,
      provider: "youtube",
      kind: nextAutoSync ? "auto_sync_on" : "auto_sync_off",
      summary: nextAutoSync
        ? `Enabled auto-sync (${pref.syncInterval}) for “${pref.title ?? playlistId}”`
        : `Disabled auto-sync for “${pref.title ?? playlistId}”`,
      meta: { playlistId, syncInterval: pref.syncInterval },
    });
  }
  if (syncMode) {
    await logConnectionActivity({
      userId: locals.user.id,
      provider: "youtube",
      kind: "sync_mode",
      summary: `Set sync mode to ${syncMode} for “${pref.title ?? playlistId}”`,
      meta: { playlistId, syncMode },
    });
  }
  if (hasHidden) {
    await logConnectionActivity({
      userId: locals.user.id,
      provider: "youtube",
      kind: body.hidden ? "playlist_hidden" : "playlist_unhidden",
      summary: body.hidden ? `Hid “${pref.title ?? playlistId}” from the playlist list` : `Unhid “${pref.title ?? playlistId}”`,
      meta: { playlistId },
    });
  }

  return json({
    playlistId,
    autoSync: pref.autoSync,
    hidden: pref.hidden,
    importStatus: pref.importStatus,
    alreadyImported: pref.alreadyImported,
    zapPlaylistId: pref.zapPlaylistId,
    syncMode: pref.syncMode,
    syncInterval: pref.syncInterval,
    title: pref.title,
    lastSyncedAt: pref.lastSyncedAt?.toISOString() ?? null,
  });
};
