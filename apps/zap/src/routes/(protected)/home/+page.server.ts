import type { PageServerLoad } from "./$types";
import { isZapAdmin } from "$lib/server/admin/access";
import { listPlayHistory } from "$lib/server/play-history";
import { listPlaylistsForUser } from "$lib/server/playlists";
import { listLiveSessionsForUser } from "$lib/server/sessions";

const HOME_PLAYLIST_LIMIT = 5;

export const load: PageServerLoad = async ({ locals }) => {
  const userId = locals.user!.id;
  const [liveSessions, playHistory, playlists] = await Promise.all([
    listLiveSessionsForUser(userId),
    listPlayHistory(userId, 5),
    listPlaylistsForUser(userId),
  ]);
  const recentPlaylists = [...playlists].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, HOME_PLAYLIST_LIMIT);

  return {
    liveSessions,
    playHistory,
    playlists: recentPlaylists,
    playlistCount: playlists.length,
    isAdmin: isZapAdmin(locals),
  };
};
