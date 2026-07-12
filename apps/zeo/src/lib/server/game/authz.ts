import { error } from "@sveltejs/kit";
import { listOpenParticipants } from "$lib/server/rooms";
import { requireHost as requireRoomHost } from "$lib/server/authz";
import type { GameRoundPhase } from "./types";

type RoomLike = { id: string; hostUserId: string };

export async function requireRoomMember(room: RoomLike, userId: string) {
  if (room.hostUserId === userId) return;

  const participants = await listOpenParticipants(room.id);
  const isMember = participants.some((participant) => participant.userId === userId);

  if (!isMember) {
    throw error(403, "You must be in this room to access game mode");
  }
}

export function requireGameHost(userId: string, hostUserId: string) {
  requireRoomHost(userId, hostUserId);
}

export async function requireGameParticipant(sessionId: string, userId: string) {
  const { db, schema } = await import("@pocket-dimension/db");
  const { eq, and } = await import("drizzle-orm");

  const participant = await db.query.gameParticipants.findFirst({
    where: and(eq(schema.gameParticipants.sessionId, sessionId), eq(schema.gameParticipants.userId, userId)),
  });

  if (!participant) {
    throw error(403, "You are not a participant in this game");
  }

  return participant;
}

export function requirePhase(actual: GameRoundPhase, expected: GameRoundPhase | GameRoundPhase[]) {
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(actual)) {
    throw error(409, `Action not allowed in phase ${actual}`);
  }
}
