import type { PageServerLoad } from "./$types";
import { listTagFilterOptions } from "$lib/server/catalogue";
import { listEnrichedYouTubePlaylists } from "$lib/server/connections/youtube-playlists";
import { listPlaylistsForUser } from "$lib/server/playlists";
import { listSavedQueues } from "$lib/server/saved-queues";
import { listLiveSessionsForUser } from "$lib/server/sessions";
import { canStartSession, primaryLiveSession } from "$lib/server/session-start";
import { getYoutubeLinkStatus } from "$lib/server/youtube";

export const load: PageServerLoad = async ({ locals }) => {
  const userId = locals.user!.id;
  const [playlists, savedQueues, liveSessions, tagOptions, ytStatus] = await Promise.all([
    listPlaylistsForUser(userId),
    listSavedQueues(userId, 30),
    listLiveSessionsForUser(userId),
    listTagFilterOptions(userId),
    getYoutubeLinkStatus(userId),
  ]);

  let connectedPlaylists: {
    id: string;
    title: string;
    itemCount: number | null;
    importStatus?: string | null;
    zapPlaylistId?: string | null;
    syncMode?: string | null;
    syncInterval?: string | null;
  }[] = [];
  if (ytStatus.linked) {
    try {
      const rows = await listEnrichedYouTubePlaylists(userId);
      connectedPlaylists = rows.map((r) => ({
        id: r.id,
        title: r.title,
        itemCount: r.itemCount ?? null,
        importStatus: r.importStatus ?? null,
        zapPlaylistId: r.zapPlaylistId ?? null,
        syncMode: r.syncMode ?? null,
        syncInterval: r.syncInterval ?? null,
      }));
    } catch {
      connectedPlaylists = [];
    }
  }

  return {
    playlists,
    availableTags: tagOptions.availableTags,
    topTagIds: tagOptions.topTagIds,
    savedQueues,
    connectedPlaylists,
    youtubeLinked: ytStatus.linked,
    liveSessions,
    canStart: canStartSession(liveSessions),
    primaryLive: primaryLiveSession(liveSessions),
  };
};
