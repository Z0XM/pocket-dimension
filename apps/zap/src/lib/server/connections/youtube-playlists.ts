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

export async function previewYouTubePlaylist(userId: string, playlistId: string): Promise<PlaylistPreview & { title?: string }> {
  const [items, playlists] = await Promise.all([
    listYouTubePlaylistItems(userId, playlistId),
    listYouTubePlaylists(userId).catch(() => []),
  ]);
  const preview = await previewPlaylistImport(userId, playlistId, items);
  const title = playlists.find((p) => p.id === playlistId)?.title;
  return { ...preview, title };
}
