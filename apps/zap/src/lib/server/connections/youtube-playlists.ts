import { listYouTubePlaylistItems, listYouTubePlaylists } from "$lib/server/youtube/api";
import {
  enrichPlaylistsWithStatus,
  previewPlaylistImport,
  recordPlaylistImportCoverage,
  type EnrichedPlaylist,
  type PlaylistPreview,
} from "./youtube-status";

/**
 * List connected playlists + prefs for the Connections UI.
 * Does **not** paginate every playlist's items (that timed out / 502'd behind reverse proxies
 * when accounts have many playlists or a large Liked list). Import status is cached on prefs
 * and refreshed on preview / import / auto-sync.
 */
export async function listEnrichedYouTubePlaylists(userId: string): Promise<EnrichedPlaylist[]> {
  const playlists = await listYouTubePlaylists(userId);
  return enrichPlaylistsWithStatus(userId, playlists);
}

/**
 * Full playlist crawl for Import preview (~700 tracks ≈ 14 Data API pages, pipelined).
 * Pass `title` from the UI to avoid a second playlists.list round-trip.
 * Also persists importStatus so the Connections list stays accurate after preview.
 */
export async function previewYouTubePlaylist(
  userId: string,
  playlistId: string,
  opts?: { title?: string }
): Promise<PlaylistPreview & { title?: string }> {
  const items = await listYouTubePlaylistItems(userId, playlistId);
  const preview = await previewPlaylistImport(userId, playlistId, items);
  const title = opts?.title;
  try {
    await recordPlaylistImportCoverage({
      userId,
      youtubePlaylistId: playlistId,
      title: title ?? null,
      total: preview.total,
      alreadyImported: preview.alreadyImported,
    });
  } catch (err) {
    console.warn("[zap youtube preview status prefs]", err);
  }
  return { ...preview, title };
}
