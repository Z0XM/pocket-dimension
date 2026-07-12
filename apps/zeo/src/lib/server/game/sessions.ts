import { db, schema } from "@pocket-dimension/db";
import { and, eq } from "drizzle-orm";
import { listOpenParticipants } from "$lib/server/rooms";
import { gameEventBus } from "./event-bus";
import { buildGameSnapshot, buildGameSnapshotForRoom } from "./snapshot";
import { autoSplitTeams, teamColorKeyForIndex, teamNameForIndex } from "./teams";
import type { GameSnapshot, GameType } from "./types";

export async function findActiveGameSession(roomId: string) {
  return db.query.gameSessions.findFirst({
    where: and(eq(schema.gameSessions.roomId, roomId), eq(schema.gameSessions.status, "active")),
  });
}

export async function getRoomGameSnapshot(roomId: string): Promise<GameSnapshot | null> {
  return buildGameSnapshotForRoom(roomId);
}

export async function publishGameSnapshot(sessionId: string) {
  const snapshot = await buildGameSnapshot(sessionId);
  if (!snapshot) return null;
  gameEventBus.publish(sessionId, snapshot);
  return snapshot;
}

export async function startGame(input: {
  roomId: string;
  hostUserId: string;
  gameType: GameType;
  teamCount: number;
}) {
  const existing = await findActiveGameSession(input.roomId);
  if (existing) {
    throw Object.assign(new Error("active_game_exists"), { code: "active_game_exists" });
  }

  const openParticipants = await listOpenParticipants(input.roomId);
  const userIds = [
    ...new Set(
      openParticipants
        .map((participant) => participant.userId)
        .filter((userId): userId is string => Boolean(userId))
    ),
  ];

  if (userIds.length < 2) {
    throw Object.assign(new Error("not_enough_players"), { code: "not_enough_players" });
  }

  const sessionId = await db.transaction(async (tx) => {
    const [session] = await tx
      .insert(schema.gameSessions)
      .values({
        roomId: input.roomId,
        hostUserId: input.hostUserId,
        gameType: input.gameType,
        status: "active",
        teamCount: input.teamCount,
        config: { snapshotVersion: 1 },
        createdAt: new Date(),
      })
      .returning();

    const teamBuckets = autoSplitTeams(userIds, input.teamCount);
    const createdTeams = await tx
      .insert(schema.gameTeams)
      .values(
        teamBuckets.map((_, index) => ({
          sessionId: session.id,
          name: teamNameForIndex(index),
          colorKey: teamColorKeyForIndex(index),
          sortOrder: index,
          score: 0,
        }))
      )
      .returning();

    await tx.insert(schema.gameParticipants).values(
      userIds.map((userId) => {
        const teamIndex = teamBuckets.findIndex((bucket) => bucket.includes(userId));
        return {
          sessionId: session.id,
          userId,
          teamId: teamIndex >= 0 ? createdTeams[teamIndex]?.id ?? null : null,
          isReady: false,
        };
      })
    );

    return session.id;
  });

  const snapshot = await publishGameSnapshot(sessionId);
  return snapshot!;
}

export async function endGame(input: { roomId: string; sessionId: string }) {
  await db
    .update(schema.gameSessions)
    .set({ status: "ended", endedAt: new Date() })
    .where(and(eq(schema.gameSessions.id, input.sessionId), eq(schema.gameSessions.roomId, input.roomId)));

  const snapshot = await buildGameSnapshot(input.sessionId);
  if (snapshot) {
    gameEventBus.publish(input.sessionId, snapshot);
  }
  gameEventBus.closeSession(input.sessionId);
  return snapshot;
}
