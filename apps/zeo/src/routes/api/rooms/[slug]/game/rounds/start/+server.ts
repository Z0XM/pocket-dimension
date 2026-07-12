import { error, json } from "@sveltejs/kit";
import { requireHost, requireUser } from "$lib/server/authz";
import { requireRoomMember } from "$lib/server/game/authz";
import { startFirstRound } from "$lib/server/game/rounds";
import { findActiveGameSession } from "$lib/server/game/sessions";
import { findRoomBySlug } from "$lib/server/rooms";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals, params }) => {
  const user = requireUser(locals);
  const slug = params.slug;
  if (!slug) throw error(400, "Room slug is required");

  const room = await findRoomBySlug(slug);
  if (!room) throw error(404, "Room not found");

  requireHost(user.id, room.hostUserId);
  await requireRoomMember(room, user.id);

  const session = await findActiveGameSession(room.id);
  if (!session) throw error(404, "No active game in this room");

  try {
    const snapshot = await startFirstRound({ sessionId: session.id, roomId: room.id });
    return json(snapshot);
  } catch (cause) {
    if (cause && typeof cause === "object" && "code" in cause) {
      if (cause.code === "round_exists") throw error(409, "A round is already in progress");
      if (cause.code === "not_all_ready") throw error(422, "Everyone must mark ready before starting round 1");
      if (cause.code === "not_enough_teams") throw error(422, "Charades needs at least two teams");
    }
    throw cause;
  }
};
