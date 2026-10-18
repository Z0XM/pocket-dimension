import type { PageServerLoad } from "./$types";
import { listTagFilterOptions } from "$lib/server/catalogue";
import { listPlaylistsForUser } from "$lib/server/playlists";
import { listSavedQueues } from "$lib/server/saved-queues";
import { listLiveSessionsForUser } from "$lib/server/sessions";
import { canStartSession, primaryLiveSession } from "$lib/server/session-start";

export const load: PageServerLoad = async ({ locals }) => {
  const userId = locals.user!.id;
  const [playlists, savedQueues, liveSessions, tagOptions] = await Promise.all([
    listPlaylistsForUser(userId),
    listSavedQueues(userId, 30),
    listLiveSessionsForUser(userId),
    listTagFilterOptions(userId),
  ]);
  return {
    playlists,
    availableTags: tagOptions.availableTags,
    topTagIds: tagOptions.topTagIds,
    savedQueues,
    liveSessions,
    canStart: canStartSession(liveSessions),
    primaryLive: primaryLiveSession(liveSessions),
  };
};
