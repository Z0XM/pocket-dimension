import type { PageServerLoad } from "./$types";
import { listPlayHistory } from "$lib/server/play-history";
import { listLiveSessionsForUser } from "$lib/server/sessions";
import { canStartSession, primaryLiveSession } from "$lib/server/session-start";

export const load: PageServerLoad = async ({ locals }) => {
  const userId = locals.user!.id;
  const [liveSessions, playHistory] = await Promise.all([listLiveSessionsForUser(userId), listPlayHistory(userId, 5)]);

  return {
    liveSessions,
    playHistory,
    canStart: canStartSession(liveSessions),
    primaryLive: primaryLiveSession(liveSessions),
  };
};
