import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { listLiveSessionsForUser, listSessionsIndexForUser } from "$lib/server/sessions";
import { canStartSession, primaryLiveSession } from "$lib/server/session-start";

export const load: PageServerLoad = async ({ locals, url }) => {
  const stay = url.searchParams.get("stay") === "1";
  const live = await listLiveSessionsForUser(locals.user!.id);
  const primary = primaryLiveSession(live);
  // Auto-enter primary live session unless ?stay=1
  if (primary && !stay) {
    throw redirect(303, `/session/${primary.id}`);
  }
  const index = stay ? await listSessionsIndexForUser(locals.user!.id) : live;
  return {
    liveSessions: live,
    indexSessions: index,
    canStart: canStartSession(live),
    primaryLive: primary,
  };
};
