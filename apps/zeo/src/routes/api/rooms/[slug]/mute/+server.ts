import { json, error } from "@sveltejs/kit";
import { requireHost, requireUser } from "$lib/server/authz";
import { readJsonBody } from "$lib/server/http";
import { muteParticipantPublishedTrack } from "$lib/server/livekit-room";
import { findRoomBySlug } from "$lib/server/rooms";
import { muteParticipantSchema } from "$lib/validation/rooms";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals, params, request }) => {
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

  requireHost(user.id, room.hostUserId);

  const { identity, track } = await readJsonBody(request, muteParticipantSchema);

  if (identity === user.id) {
    throw error(400, "Host cannot mute themselves this way");
  }

  const muted = await muteParticipantPublishedTrack(room.livekitRoomName, identity, track);
  if (!muted) {
    throw error(404, "Participant track not found");
  }

  return json({ ok: true });
};
