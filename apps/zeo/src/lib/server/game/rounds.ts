import { db, schema } from "@pocket-dimension/db";
import { and, asc, eq } from "drizzle-orm";
import { publishGameSnapshot } from "./sessions";

async function bumpSnapshotVersion(sessionId: string) {
  const session = await db.query.gameSessions.findFirst({
    where: eq(schema.gameSessions.id, sessionId),
  });
  if (!session) return;

  const config = { ...(session.config ?? {}), snapshotVersion: (Number(session.config?.snapshotVersion) || 0) + 1 };
  await db.update(schema.gameSessions).set({ config }).where(eq(schema.gameSessions.id, sessionId));
}

async function loadSessionTeams(sessionId: string) {
  return db.query.gameTeams.findMany({
    where: eq(schema.gameTeams.sessionId, sessionId),
    orderBy: [asc(schema.gameTeams.sortOrder)],
  });
}

async function loadParticipants(sessionId: string) {
  return db.query.gameParticipants.findMany({
    where: eq(schema.gameParticipants.sessionId, sessionId),
  });
}

async function loadCurrentRound(sessionId: string) {
  return db.query.gameRounds.findFirst({
    where: eq(schema.gameRounds.sessionId, sessionId),
    orderBy: (table, { desc }) => [desc(table.roundNumber)],
  });
}

export async function markParticipantReady(input: { sessionId: string; userId: string }) {
  const round = await loadCurrentRound(input.sessionId);

  if (round && round.phase !== "ready_check") {
    throw Object.assign(new Error("wrong_phase"), { code: "wrong_phase" });
  }

  await db
    .update(schema.gameParticipants)
    .set({ isReady: true })
    .where(and(eq(schema.gameParticipants.sessionId, input.sessionId), eq(schema.gameParticipants.userId, input.userId)));

  if (round?.phase === "ready_check") {
    const participants = await loadParticipants(input.sessionId);
    if (participants.length > 0 && participants.every((participant) => participant.isReady)) {
      await createNextRound(input.sessionId);
      await bumpSnapshotVersion(input.sessionId);
      return publishGameSnapshot(input.sessionId);
    }
  }

  await bumpSnapshotVersion(input.sessionId);
  return publishGameSnapshot(input.sessionId);
}

async function pickMimeUserId(guessingTeamId: string, sessionId: string, config: Record<string, unknown>) {
  const participants = await loadParticipants(sessionId);
  const teamMembers = participants.filter((participant) => participant.teamId === guessingTeamId).map((participant) => participant.userId);
  if (teamMembers.length === 0) {
    throw Object.assign(new Error("no_mime"), { code: "no_mime" });
  }

  const rotation = (config.mimeRotation ?? {}) as Record<string, number>;
  const index = rotation[guessingTeamId] ?? 0;
  return teamMembers[index % teamMembers.length]!;
}

export async function startFirstRound(input: { sessionId: string; roomId: string }) {
  const existing = await loadCurrentRound(input.sessionId);
  if (existing) {
    throw Object.assign(new Error("round_exists"), { code: "round_exists" });
  }

  const teams = await loadSessionTeams(input.sessionId);
  if (teams.length < 2) {
    throw Object.assign(new Error("not_enough_teams"), { code: "not_enough_teams" });
  }

  const participants = await loadParticipants(input.sessionId);
  if (participants.length === 0 || !participants.every((participant) => participant.isReady)) {
    throw Object.assign(new Error("not_all_ready"), { code: "not_all_ready" });
  }

  const proposingTeam = teams[0]!;
  const guessingTeam = teams[1]!;

  const session = await db.query.gameSessions.findFirst({
    where: eq(schema.gameSessions.id, input.sessionId),
  });
  if (!session) {
    throw Object.assign(new Error("session_missing"), { code: "session_missing" });
  }

  const config = { ...(session.config ?? {}) };
  const mimeUserId = await pickMimeUserId(guessingTeam.id, input.sessionId, config);

  await db.transaction(async (tx) => {
    await tx
      .update(schema.gameParticipants)
      .set({ isReady: false })
      .where(eq(schema.gameParticipants.sessionId, input.sessionId));

    await tx.insert(schema.gameRounds).values({
      sessionId: input.sessionId,
      roundNumber: 1,
      proposingTeamId: proposingTeam.id,
      guessingTeamId: guessingTeam.id,
      mimeUserId,
      phase: "submission",
      createdAt: new Date(),
    });

    await tx
      .update(schema.gameSessions)
      .set({
        config: {
          ...config,
          snapshotVersion: (Number(config.snapshotVersion) || 0) + 1,
          mimeRotation: {
            ...((config.mimeRotation as Record<string, number> | undefined) ?? {}),
            [guessingTeam.id]: 1,
          },
        },
      })
      .where(eq(schema.gameSessions.id, input.sessionId));
  });

  return publishGameSnapshot(input.sessionId);
}

async function createNextRound(sessionId: string) {
  const session = await db.query.gameSessions.findFirst({
    where: eq(schema.gameSessions.id, sessionId),
  });
  if (!session) return;

  const currentRound = await loadCurrentRound(sessionId);
  if (!currentRound) return;

  const teams = await loadSessionTeams(sessionId);
  const nextRoundNumber = currentRound.roundNumber + 1;
  const proposingTeamId = currentRound.guessingTeamId;
  const guessingTeamId = currentRound.proposingTeamId;

  const config = { ...(session.config ?? {}) };
  const mimeUserId = await pickMimeUserId(guessingTeamId, sessionId, config);
  const rotation = (config.mimeRotation ?? {}) as Record<string, number>;
  const nextIndex = (rotation[guessingTeamId] ?? 0) + 1;

  await db.transaction(async (tx) => {
    await tx
      .update(schema.gameParticipants)
      .set({ isReady: false })
      .where(eq(schema.gameParticipants.sessionId, sessionId));

    await tx.insert(schema.gameRounds).values({
      sessionId,
      roundNumber: nextRoundNumber,
      proposingTeamId,
      guessingTeamId,
      mimeUserId,
      phase: "submission",
      createdAt: new Date(),
    });

    await tx
      .update(schema.gameSessions)
      .set({
        config: {
          ...config,
          mimeRotation: {
            ...rotation,
            [guessingTeamId]: nextIndex,
          },
        },
      })
      .where(eq(schema.gameSessions.id, sessionId));
  });
}
