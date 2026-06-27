import { json, error } from "@sveltejs/kit";
import { requireHost, requireUser } from "$lib/server/authz";
import { readJsonBody } from "$lib/server/http";
import { removeLiveKitParticipant } from "$lib/server/livekit-room";
import { blockParticipant } from "$lib/server/session-blocks";
import { findRoomBySlug, markParticipantRemoved } from "$lib/server/rooms";
import { removeParticipantSchema } from "$lib/validation/rooms";
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

  const { identity } = await readJsonBody(request, removeParticipantSchema);

  if (identity === user.id) {
    throw error(400, "Host cannot remove themselves");
  }

  try {
    await removeLiveKitParticipant(room.livekitRoomName, identity);
  } catch {
    // Participant may already be disconnected
  }

  await blockParticipant({
    roomId: room.id,
    participantIdentity: identity,
    blockedById: user.id,
  });

  await markParticipantRemoved({
    roomId: room.id,
    identity,
    removedById: user.id,
  });

  return json({ ok: true });
};
