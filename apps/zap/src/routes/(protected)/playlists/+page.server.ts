import type { PageServerLoad } from "./$types";
import { listPlaylistsForUser } from "$lib/server/playlists";
import { listSavedQueues } from "$lib/server/saved-queues";
import { listLiveSessionsForUser } from "$lib/server/sessions";
import { canStartSession, primaryLiveSession } from "$lib/server/session-start";

export const load: PageServerLoad = async ({ locals }) => {
  const userId = locals.user!.id;
  const [playlists, savedQueues, liveSessions] = await Promise.all([
    listPlaylistsForUser(userId),
    listSavedQueues(userId, 30),
    listLiveSessionsForUser(userId),
  ]);
  return {
    playlists,
    savedQueues,
    liveSessions,
    canStart: canStartSession(liveSessions),
    primaryLive: primaryLiveSession(liveSessions),
  };
};
