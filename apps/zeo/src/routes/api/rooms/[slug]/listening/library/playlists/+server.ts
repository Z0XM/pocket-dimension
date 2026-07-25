import { error, json } from "@sveltejs/kit";
import { requireUser } from "$lib/server/authz";
import { requireRoomMember } from "$lib/server/listening/authz";
import { findActiveListeningSession } from "$lib/server/listening/sessions";
import { listYouTubePlaylists } from "$lib/server/listening/youtube-api";
import { findRoomBySlug } from "$lib/server/rooms";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, params }) => {
  const user = requireUser(locals);
  if (!params.slug) throw error(400, "Room slug is required");
  const room = await findRoomBySlug(params.slug);
  if (!room) throw error(404, "Room not found");
  await requireRoomMember(room, user.id);

  const session = await findActiveListeningSession(room.id);
  if (!session) throw error(404, "No active listening session in this room");

  return json({ playlists: await listYouTubePlaylists(session.linkerUserId) });
};
