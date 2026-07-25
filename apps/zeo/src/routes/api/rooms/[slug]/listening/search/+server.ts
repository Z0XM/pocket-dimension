import { error, json } from "@sveltejs/kit";
import { requireUser } from "$lib/server/authz";
import { requireRoomMember } from "$lib/server/listening/authz";
import { findActiveListeningSession } from "$lib/server/listening/sessions";
import { getYouTubeAccessTokenForUser, parseYouTubeVideoId, resolveYouTubeVideo, searchYouTubeVideos } from "$lib/server/listening/youtube-api";
import { findRoomBySlug } from "$lib/server/rooms";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, params, url }) => {
  const user = requireUser(locals);
  if (!params.slug) throw error(400, "Room slug is required");
  const room = await findRoomBySlug(params.slug);
  if (!room) throw error(404, "Room not found");
  await requireRoomMember(room, user.id);

  const query = url.searchParams.get("q")?.trim();
  if (!query) throw error(400, "Search query is required");

  const session = await findActiveListeningSession(room.id);
  if (!session) throw error(404, "No active listening session in this room");

  const accessToken = await getYouTubeAccessTokenForUser(session.linkerUserId);
  const videoId = parseYouTubeVideoId(query);
  if (videoId) {
    const item = await resolveYouTubeVideo(videoId, accessToken ?? undefined);
    return json({ items: item ? [{ ...item, source: "url" }] : [] });
  }

  return json({ items: await searchYouTubeVideos(query, accessToken ?? undefined) });
};
