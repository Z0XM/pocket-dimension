import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getYoutubeLinkStatus, listYouTubePlaylists } from "$lib/server/youtube";

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");

  const status = await getYoutubeLinkStatus(locals.user.id);
  if (!status.linked) throw error(403, "Connect YouTube first");

  const playlists = await listYouTubePlaylists(locals.user.id);
  return json({ playlists });
};
