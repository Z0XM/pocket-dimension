import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { listAvailableTags } from "$lib/server/catalogue";
import { PlaylistError, getPlaylistDetail } from "$lib/server/playlists";
import { listLiveSessionsForUser } from "$lib/server/sessions";
import { canStartSession, primaryLiveSession } from "$lib/server/session-start";

export const load: PageServerLoad = async ({ locals, params }) => {
  const userId = locals.user!.id;
  try {
    const [playlist, availableTags, liveSessions] = await Promise.all([
      getPlaylistDetail(params.id!, userId),
      listAvailableTags(userId),
      listLiveSessionsForUser(userId),
    ]);
    return {
      playlist,
      availableTags: availableTags.map((t) => ({ id: t.id, name: t.name, kind: t.kind })),
      liveSessions,
      canStart: canStartSession(liveSessions),
      primaryLive: primaryLiveSession(liveSessions),
    };
  } catch (err) {
    if (err instanceof PlaylistError) throw error(err.status, err.message);
    throw err;
  }
};
