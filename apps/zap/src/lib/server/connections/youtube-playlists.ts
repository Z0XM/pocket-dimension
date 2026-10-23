import { listYouTubePlaylistItems, listYouTubePlaylists } from "$lib/server/youtube/api";
import {
  enrichPlaylistsWithStatus,
  previewPlaylistImport,
  type EnrichedPlaylist,
  type PlaylistPreview,
} from "./youtube-status";

/**
 * List connected playlists + prefs for the Connections UI.
 * Does **not** paginate every playlist's items (that timed out / 502'd behind reverse proxies
 * when accounts have many playlists or a large Liked list). Import status is refined on
 * preview / import via {@link previewYouTubePlaylist}.
 */
export async function listEnrichedYouTubePlaylists(userId: string): Promise<EnrichedPlaylist[]> {
  const playlists = await listYouTubePlaylists(userId);
  return enrichPlaylistsWithStatus(userId, playlists);
}

/**
 * Full playlist crawl for Import preview (~700 tracks ≈ 14 Data API pages, pipelined).
 * Pass `title` from the UI to avoid a second playlists.list round-trip.
 */
export async function previewYouTubePlaylist(
  userId: string,
  playlistId: string,
  opts?: { title?: string }
): Promise<PlaylistPreview & { title?: string }> {
  const items = await listYouTubePlaylistItems(userId, playlistId);
  const preview = await previewPlaylistImport(userId, playlistId, items);
  return { ...preview, title: opts?.title };
}
