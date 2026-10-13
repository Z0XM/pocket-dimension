import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { listLiveSessionsForUser } from "$lib/server/sessions";
import { canStartSession, primaryLiveSession } from "$lib/server/session-start";

export const load: PageServerLoad = async ({ locals, url }) => {
  const live = await listLiveSessionsForUser(locals.user!.id);
  const primary = primaryLiveSession(live);
  // Auto-enter primary live session unless ?stay=1
  if (primary && url.searchParams.get("stay") !== "1") {
    throw redirect(303, `/session/${primary.id}`);
  }
  return {
    liveSessions: live,
    canStart: canStartSession(live),
    primaryLive: primary,
  };
};
