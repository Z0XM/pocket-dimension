import { db, schema } from "@pocket-dimension/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { displayNameForUser } from "$lib/server/authz";
import type {
  GameSnapshot,
  GameSnapshotParticipant,
  GameSnapshotRoomScore,
  GameSnapshotRound,
  GameSnapshotSession,
  GameSnapshotTeam,
} from "./types";

export function emptyGameSnapshot(): GameSnapshot {
  return {
    version: 0,
    session: null,
    teams: [],
    participants: [],
    round: null,
    roomScores: [],
  };
}

export function snapshotVersionFromConfig(config: Record<string, unknown> | null | undefined) {
  const raw = config?.snapshotVersion;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

type SnapshotRows = {
  session: typeof schema.gameSessions.$inferSelect;
  teams: (typeof schema.gameTeams.$inferSelect)[];
  participants: (typeof schema.gameParticipants.$inferSelect)[];
  round: typeof schema.gameRounds.$inferSelect | null;
  roomScores: (typeof schema.roomScores.$inferSelect)[];
  userNames: Map<string, string>;
};

export function buildGameSnapshotFromRows(rows: SnapshotRows): GameSnapshot {
  const teams: GameSnapshotTeam[] = rows.teams
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((team) => ({
      id: team.id,
      name: team.name,
      colorKey: team.colorKey,
      sortOrder: team.sortOrder,
      score: team.score,
      memberUserIds: rows.participants.filter((participant) => participant.teamId === team.id).map((participant) => participant.userId),
    }));

  const participants: GameSnapshotParticipant[] = rows.participants.map((participant) => ({
    userId: participant.userId,
    teamId: participant.teamId,
    isReady: participant.isReady,
    displayName: rows.userNames.get(participant.userId) ?? "Player",
  }));

  const session: GameSnapshotSession = {
    id: rows.session.id,
    roomId: rows.session.roomId,
    hostUserId: rows.session.hostUserId,
    gameType: rows.session.gameType,
    status: rows.session.status,
    teamCount: rows.session.teamCount,
    createdAt: rows.session.createdAt.toISOString(),
    endedAt: rows.session.endedAt?.toISOString() ?? null,
  };

  const round: GameSnapshotRound | null = rows.round
    ? {
        id: rows.round.id,
        roundNumber: rows.round.roundNumber,
        proposingTeamId: rows.round.proposingTeamId,
        guessingTeamId: rows.round.guessingTeamId,
        mimeUserId: rows.round.mimeUserId,
        phase: rows.round.phase,
        lockedWord: rows.round.lockedWord,
        lockedSuggestionId: rows.round.lockedSuggestionId,
        verdict: rows.round.verdict,
      }
    : null;

  const roomScores: GameSnapshotRoomScore[] = rows.roomScores.map((score) => ({
    userId: score.userId,
    displayName: rows.userNames.get(score.userId) ?? "Player",
    totalScore: score.totalScore,
    gamesPlayed: score.gamesPlayed,
  }));

  return {
    version: snapshotVersionFromConfig(rows.session.config),
    session,
    teams,
    participants,
    round,
    roomScores,
  };
}

async function loadUserNames(userIds: string[]) {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return new Map<string, string>();

  const users = await db.query.user.findMany({
    where: (table, { inArray }) => inArray(table.id, uniqueIds),
  });

  return new Map(users.map((user) => [user.id, displayNameForUser(user)]));
}

export async function buildGameSnapshot(sessionId: string): Promise<GameSnapshot | null> {
  const session = await db.query.gameSessions.findFirst({
    where: eq(schema.gameSessions.id, sessionId),
  });

  if (!session) return null;

  const round = await db.query.gameRounds.findFirst({
    where: eq(schema.gameRounds.sessionId, sessionId),
    orderBy: [desc(schema.gameRounds.roundNumber)],
  });

  const [teams, participants, roomScores] = await Promise.all([
    db.query.gameTeams.findMany({
      where: eq(schema.gameTeams.sessionId, sessionId),
      orderBy: [asc(schema.gameTeams.sortOrder)],
    }),
    db.query.gameParticipants.findMany({
      where: eq(schema.gameParticipants.sessionId, sessionId),
    }),
    db.query.roomScores.findMany({
      where: eq(schema.roomScores.roomId, session.roomId),
    }),
  ]);

  const userIds = [
    ...participants.map((participant) => participant.userId),
    ...roomScores.map((score) => score.userId),
  ];
  const userNames = await loadUserNames(userIds);

  return buildGameSnapshotFromRows({
    session,
    teams,
    participants,
    round: round ?? null,
    roomScores,
    userNames,
  });
}

export async function buildGameSnapshotForRoom(roomId: string): Promise<GameSnapshot | null> {
  const session = await db.query.gameSessions.findFirst({
    where: and(eq(schema.gameSessions.roomId, roomId), eq(schema.gameSessions.status, "active")),
    orderBy: [desc(schema.gameSessions.createdAt)],
  });

  if (!session) return null;
  return buildGameSnapshot(session.id);
}
