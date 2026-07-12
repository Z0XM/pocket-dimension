import { error, json } from "@sveltejs/kit";
import { requireHost, requireUser } from "$lib/server/authz";
import { readJsonBody } from "$lib/server/http";
import { endGame, findActiveGameSession, getRoomGameSnapshot, startGame } from "$lib/server/game/sessions";
import { requireRoomMember } from "$lib/server/game/authz";
import { findRoomBySlug } from "$lib/server/rooms";
import { startGameSchema } from "$lib/validation/rooms";
import type { RequestHandler } from "./$types";

async function loadRoomContext(slug: string) {
  const room = await findRoomBySlug(slug);
  if (!room) {
    throw error(404, "Room not found");
  }
  return room;
}

export const GET: RequestHandler = async ({ locals, params }) => {
  const user = requireUser(locals);
  const slug = params.slug;
  if (!slug) throw error(400, "Room slug is required");

  const room = await loadRoomContext(slug);
  await requireRoomMember(room, user.id);

  const snapshot = await getRoomGameSnapshot(room.id);
  if (!snapshot?.session || snapshot.session.status !== "active") {
    throw error(404, "No active game in this room");
  }

  return json(snapshot);
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const user = requireUser(locals);
  const slug = params.slug;
  if (!slug) throw error(400, "Room slug is required");

  const room = await loadRoomContext(slug);
  requireHost(user.id, room.hostUserId);
  await requireRoomMember(room, user.id);

  const body = await readJsonBody(request, startGameSchema);

  try {
    const snapshot = await startGame({
      roomId: room.id,
      hostUserId: user.id,
      gameType: body.gameType,
      teamCount: body.teamCount,
    });
    return json(snapshot);
  } catch (cause) {
    if (cause && typeof cause === "object" && "code" in cause) {
      if (cause.code === "active_game_exists") {
        throw error(409, "A game is already active in this room");
      }
      if (cause.code === "not_enough_players") {
        throw error(422, "At least two participants are required to start a game");
      }
    }
    throw cause;
  }
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
  const user = requireUser(locals);
  const slug = params.slug;
  if (!slug) throw error(400, "Room slug is required");

  const room = await loadRoomContext(slug);
  requireHost(user.id, room.hostUserId);

  const session = await findActiveGameSession(room.id);
  if (!session) {
    throw error(404, "No active game in this room");
  }

  const snapshot = await endGame({ roomId: room.id, sessionId: session.id });
  return json(snapshot ?? { version: 0, session: null, teams: [], participants: [], round: null, roomScores: [] });
};
