import { error, json } from "@sveltejs/kit";
import { requireUser } from "$lib/server/authz";
import { requireRoomMember } from "$lib/server/game/authz";
import { markParticipantReady } from "$lib/server/game/rounds";
import { findActiveGameSession } from "$lib/server/game/sessions";
import { findRoomBySlug } from "$lib/server/rooms";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals, params }) => {
  const user = requireUser(locals);
  const slug = params.slug;
  if (!slug) throw error(400, "Room slug is required");

  const room = await findRoomBySlug(slug);
  if (!room) throw error(404, "Room not found");

  await requireRoomMember(room, user.id);

  const session = await findActiveGameSession(room.id);
  if (!session) throw error(404, "No active game in this room");

  try {
    const snapshot = await markParticipantReady({ sessionId: session.id, userId: user.id });
    return json(snapshot);
  } catch (cause) {
    if (cause && typeof cause === "object" && "code" in cause && cause.code === "wrong_phase") {
      throw error(409, "You can only mark ready between rounds");
    }
    throw cause;
  }
};
