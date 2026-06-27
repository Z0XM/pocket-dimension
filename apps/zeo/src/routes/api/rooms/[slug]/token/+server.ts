import { json, error } from "@sveltejs/kit";
import { displayNameForUser, requireUser } from "$lib/server/authz";
import { mintRoomJoinToken, publicLiveKitWsUrl } from "$lib/server/livekit-token";
import { findRoomBySlug } from "$lib/server/rooms";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals, params }) => {
  const user = requireUser(locals);
  const slug = params.slug;

  if (!slug) {
    throw error(400, "Room slug is required");
  }

  const room = await findRoomBySlug(slug);
  if (!room) {
    throw error(404, "Room not found");
  }

  if (room.status === "ended") {
    throw error(410, "This room has ended");
  }

  const token = await mintRoomJoinToken({
    livekitRoomName: room.livekitRoomName,
    identity: user.id,
    name: displayNameForUser(user),
  });

  return json({
    token,
    wsUrl: publicLiveKitWsUrl(),
  });
};
