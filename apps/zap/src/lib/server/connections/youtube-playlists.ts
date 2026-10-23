import { mapPool } from "$lib/server/ingest/map-pool";
import { listYouTubePlaylistItems, listYouTubePlaylists } from "$lib/server/youtube/api";
import {
  enrichPlaylistsWithStatus,
  loadPlaylistPrefs,
  previewPlaylistImport,
  type EnrichedPlaylist,
  type PlaylistPreview,
} from "./youtube-status";

/** List connected playlists with real import status (fetches items with limited concurrency). */
export async function listEnrichedYouTubePlaylists(userId: string): Promise<EnrichedPlaylist[]> {
  const playlists = await listYouTubePlaylists(userId);
  const prefs = await loadPlaylistPrefs(userId);
  const base = await enrichPlaylistsWithStatus(userId, playlists);

  const enriched = await mapPool(base, 3, async (p) => {
    try {
      const items = await listYouTubePlaylistItems(userId, p.id);
      const preview = await previewPlaylistImport(userId, p.id, items);
      const pref = prefs.get(p.id);
      return {
        ...p,
        itemCount: items.length,
        importStatus: preview.importStatus,
        alreadyImported: preview.alreadyImported,
        autoSync: pref?.autoSync ?? false,
        lastSyncedAt: pref?.lastSyncedAt?.toISOString() ?? null,
        lastSyncError: pref?.lastSyncError ?? null,
      } satisfies EnrichedPlaylist;
    } catch (err) {
      console.warn("[zap connections] playlist status", p.id, err);
      return p;
    }
  });

  return enriched;
}

export async function previewYouTubePlaylist(userId: string, playlistId: string): Promise<PlaylistPreview & { title?: string }> {
  const [items, playlists] = await Promise.all([
    listYouTubePlaylistItems(userId, playlistId),
    listYouTubePlaylists(userId).catch(() => []),
  ]);
  const preview = await previewPlaylistImport(userId, playlistId, items);
  const title = playlists.find((p) => p.id === playlistId)?.title;
  return { ...preview, title };
}
