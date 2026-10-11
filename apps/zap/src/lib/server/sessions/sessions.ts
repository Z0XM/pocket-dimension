import { db, schema } from "@pocket-dimension/db";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { sessionEventBus } from "./event-bus";
import { isSessionIdle } from "./idle";
import { generateJoinCode, normalizeJoinCode } from "./join-code";
import { canAddToQueue, canControlTransport, canEndSession, canManageGuestPermissions } from "./permissions";
import { buildSessionSnapshot } from "./snapshot";
import type { SessionSnapshot } from "./types";

export class SessionError extends Error {
  constructor(
    message: string,
    readonly status: number = 400
  ) {
    super(message);
    this.name = "SessionError";
  }
}

async function publish(sessionId: string, viewerUserId?: string | null) {
  const snapshot = await buildSessionSnapshot(sessionId, viewerUserId);
  if (snapshot) sessionEventBus.publish(sessionId, snapshot);
  return snapshot;
}

async function requireLiveSession(sessionId: string) {
  const session = await db.query.sessions.findFirst({
    where: eq(schema.sessions.id, sessionId),
  });
  if (!session) throw new SessionError("Session not found", 404);
  if (session.status !== "live" || session.endedAt) throw new SessionError("Session has ended", 410);

  if (isSessionIdle(session.lastActivityAt)) {
    await endSessionInternal(session.id, "idle");
    throw new SessionError("Session ended due to inactivity", 410);
  }

  return session;
}

async function requireMember(sessionId: string, userId: string) {
  const member = await db.query.sessionMembers.findFirst({
    where: and(eq(schema.sessionMembers.sessionId, sessionId), eq(schema.sessionMembers.userId, userId), isNull(schema.sessionMembers.leftAt)),
  });
  if (!member) throw new SessionError("Join the session first", 403);
  return member;
}

async function touchActivity(sessionId: string) {
  await db
    .update(schema.sessions)
    .set({ lastActivityAt: sql`now()` })
    .where(eq(schema.sessions.id, sessionId));
}

async function bumpGeneration(
  sessionId: string,
  currentGeneration: number,
  patch: Partial<{
    playbackState: "idle" | "playing" | "paused";
    positionMs: number;
    currentQueueItemId: string | null;
  }>
) {
  const now = new Date();
  await db
    .update(schema.sessions)
    .set({
      ...patch,
      positionUpdatedAt: now,
      playbackGeneration: currentGeneration + 1,
      lastActivityAt: now,
    })
    .where(eq(schema.sessions.id, sessionId));
}

async function endSessionInternal(sessionId: string, _reason: "host" | "idle") {
  const now = new Date();
  await db
    .update(schema.sessions)
    .set({ status: "ended", endedAt: now, playbackState: "idle" })
    .where(and(eq(schema.sessions.id, sessionId), eq(schema.sessions.status, "live")));
  await db
    .update(schema.sessionMembers)
    .set({ leftAt: now })
    .where(and(eq(schema.sessionMembers.sessionId, sessionId), isNull(schema.sessionMembers.leftAt)));
  const snapshot = await buildSessionSnapshot(sessionId);
  if (snapshot) sessionEventBus.publish(sessionId, snapshot);
  sessionEventBus.closeSession(sessionId);
  // Best-effort Discord leave (dynamic import avoids circular deps at module load)
  void import("$lib/server/discord").then((m) => m.onSessionEnded(sessionId)).catch(() => {});
  return snapshot;
}

async function allocateJoinCode(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generateJoinCode();
    const existing = await db.query.sessions.findFirst({
      where: eq(schema.sessions.joinCode, code),
    });
    if (!existing) return code;
  }
  throw new SessionError("Could not allocate a join code", 500);
}

export async function createSession(hostUserId: string): Promise<SessionSnapshot> {
  const joinCode = await allocateJoinCode();
  const [session] = await db
    .insert(schema.sessions)
    .values({
      hostUserId,
      joinCode,
      status: "live",
      playbackState: "idle",
      guestsCanAdd: false,
      guestsCanControl: false,
    })
    .returning();

  if (!session) throw new SessionError("Failed to create session", 500);

  await db.insert(schema.sessionMembers).values({
    sessionId: session.id,
    userId: hostUserId,
    role: "host",
  });

  const snapshot = await buildSessionSnapshot(session.id, hostUserId);
  if (!snapshot) throw new SessionError("Failed to load session", 500);
  return snapshot;
}

export async function joinSessionByCode(userId: string, rawCode: string): Promise<SessionSnapshot> {
  const joinCode = normalizeJoinCode(rawCode);
  if (!joinCode) throw new SessionError("Enter a join code");

  const session = await db.query.sessions.findFirst({
    where: and(eq(schema.sessions.joinCode, joinCode), eq(schema.sessions.status, "live")),
  });
  if (!session) throw new SessionError("No live session for that code", 404);

  if (isSessionIdle(session.lastActivityAt)) {
    await endSessionInternal(session.id, "idle");
    throw new SessionError("Session ended due to inactivity", 410);
  }

  const existing = await db.query.sessionMembers.findFirst({
    where: and(eq(schema.sessionMembers.sessionId, session.id), eq(schema.sessionMembers.userId, userId), isNull(schema.sessionMembers.leftAt)),
  });

  if (!existing) {
    const role = session.hostUserId === userId ? "host" : "guest";
    await db.insert(schema.sessionMembers).values({
      sessionId: session.id,
      userId,
      role,
    });
  }

  await touchActivity(session.id);
  const snapshot = await publish(session.id, userId);
  if (!snapshot) throw new SessionError("Failed to join", 500);
  return snapshot;
}

export async function getSessionForUser(sessionId: string, userId: string): Promise<SessionSnapshot> {
  await requireLiveSession(sessionId);
  await requireMember(sessionId, userId);
  const snapshot = await buildSessionSnapshot(sessionId, userId);
  if (!snapshot) throw new SessionError("Session not found", 404);
  return snapshot;
}

export async function endSession(sessionId: string, userId: string): Promise<SessionSnapshot | null> {
  const session = await requireLiveSession(sessionId);
  const member = await requireMember(sessionId, userId);
  if (!canEndSession(member.role)) throw new SessionError("Only the host can end the session", 403);
  if (session.hostUserId !== userId && member.role !== "host") {
    throw new SessionError("Only the host can end the session", 403);
  }
  return endSessionInternal(sessionId, "host");
}

export async function setGuestPermissions(
  sessionId: string,
  userId: string,
  flags: { guestsCanAdd?: boolean; guestsCanControl?: boolean }
): Promise<SessionSnapshot> {
  await requireLiveSession(sessionId);
  const member = await requireMember(sessionId, userId);
  if (!canManageGuestPermissions(member.role)) {
    throw new SessionError("Only the host can change guest permissions", 403);
  }

  await db
    .update(schema.sessions)
    .set({
      ...(flags.guestsCanAdd !== undefined ? { guestsCanAdd: flags.guestsCanAdd } : {}),
      ...(flags.guestsCanControl !== undefined ? { guestsCanControl: flags.guestsCanControl } : {}),
      lastActivityAt: sql`now()`,
    })
    .where(eq(schema.sessions.id, sessionId));

  const snapshot = await publish(sessionId, userId);
  if (!snapshot) throw new SessionError("Session not found", 404);
  return snapshot;
}

export async function enqueueCatalogueTrack(sessionId: string, userId: string, mediaAssetId: string): Promise<SessionSnapshot> {
  const session = await requireLiveSession(sessionId);
  const member = await requireMember(sessionId, userId);
  const flags = { guestsCanAdd: session.guestsCanAdd, guestsCanControl: session.guestsCanControl };
  if (!canAddToQueue(member.role, flags)) {
    throw new SessionError("You can't add to the queue (listen-only)", 403);
  }

  const asset = await db.query.mediaAssets.findFirst({
    where: eq(schema.mediaAssets.id, mediaAssetId),
  });
  if (!asset || asset.status !== "ready" || !asset.storageKey) {
    throw new SessionError("Track not playable", 400);
  }

  const last = await db.query.queueItems.findFirst({
    where: eq(schema.queueItems.sessionId, sessionId),
    orderBy: [desc(schema.queueItems.position)],
  });
  const position = (last?.position ?? -1) + 1;

  const [item] = await db
    .insert(schema.queueItems)
    .values({
      sessionId,
      mediaAssetId,
      position,
      addedByUserId: userId,
    })
    .returning();

  if (!item) throw new SessionError("Failed to enqueue", 500);

  // Auto-start if idle with nothing current
  if (session.playbackState === "idle" && !session.currentQueueItemId) {
    await bumpGeneration(sessionId, session.playbackGeneration, {
      playbackState: "playing",
      currentQueueItemId: item.id,
      positionMs: 0,
    });
  } else {
    await touchActivity(sessionId);
  }

  const snapshot = await publish(sessionId, userId);
  if (!snapshot) throw new SessionError("Session not found", 404);
  return snapshot;
}

export async function play(sessionId: string, userId: string): Promise<SessionSnapshot> {
  const session = await requireLiveSession(sessionId);
  const member = await requireMember(sessionId, userId);
  if (!canControlTransport(member.role, { guestsCanAdd: session.guestsCanAdd, guestsCanControl: session.guestsCanControl })) {
    throw new SessionError("You can't control playback", 403);
  }

  let currentId = session.currentQueueItemId;
  if (!currentId) {
    const first = await db.query.queueItems.findFirst({
      where: eq(schema.queueItems.sessionId, sessionId),
      orderBy: [asc(schema.queueItems.position)],
    });
    if (!first) throw new SessionError("Queue is empty", 400);
    currentId = first.id;
  }

  await bumpGeneration(sessionId, session.playbackGeneration, {
    playbackState: "playing",
    currentQueueItemId: currentId,
    positionMs: session.currentQueueItemId === currentId ? session.positionMs : 0,
  });

  const snapshot = await publish(sessionId, userId);
  if (!snapshot) throw new SessionError("Session not found", 404);
  return snapshot;
}

export async function pause(sessionId: string, userId: string): Promise<SessionSnapshot> {
  const session = await requireLiveSession(sessionId);
  const member = await requireMember(sessionId, userId);
  if (!canControlTransport(member.role, { guestsCanAdd: session.guestsCanAdd, guestsCanControl: session.guestsCanControl })) {
    throw new SessionError("You can't control playback", 403);
  }

  // Freeze clock: compute elapsed if was playing
  let positionMs = session.positionMs;
  if (session.playbackState === "playing") {
    const elapsed = Date.now() - session.positionUpdatedAt.getTime();
    positionMs = Math.max(0, session.positionMs + elapsed);
  }

  await bumpGeneration(sessionId, session.playbackGeneration, { playbackState: "paused", positionMs });
  const snapshot = await publish(sessionId, userId);
  if (!snapshot) throw new SessionError("Session not found", 404);
  return snapshot;
}

export async function seek(sessionId: string, userId: string, positionMs: number): Promise<SessionSnapshot> {
  const session = await requireLiveSession(sessionId);
  const member = await requireMember(sessionId, userId);
  if (!canControlTransport(member.role, { guestsCanAdd: session.guestsCanAdd, guestsCanControl: session.guestsCanControl })) {
    throw new SessionError("You can't control playback", 403);
  }
  if (!Number.isFinite(positionMs) || positionMs < 0) throw new SessionError("Invalid seek position");

  await bumpGeneration(sessionId, session.playbackGeneration, {
    playbackState: session.playbackState === "idle" ? "paused" : session.playbackState,
    positionMs: Math.floor(positionMs),
  });
  const snapshot = await publish(sessionId, userId);
  if (!snapshot) throw new SessionError("Session not found", 404);
  return snapshot;
}

export async function skip(sessionId: string, userId: string): Promise<SessionSnapshot> {
  const session = await requireLiveSession(sessionId);
  const member = await requireMember(sessionId, userId);
  if (!canControlTransport(member.role, { guestsCanAdd: session.guestsCanAdd, guestsCanControl: session.guestsCanControl })) {
    throw new SessionError("You can't control playback", 403);
  }

  const queue = await db.query.queueItems.findMany({
    where: eq(schema.queueItems.sessionId, sessionId),
    orderBy: [asc(schema.queueItems.position)],
  });
  if (queue.length === 0) throw new SessionError("Queue is empty", 400);

  const idx = session.currentQueueItemId ? queue.findIndex((q) => q.id === session.currentQueueItemId) : -1;
  const next = queue[idx + 1] ?? null;

  if (!next) {
    await bumpGeneration(sessionId, session.playbackGeneration, {
      playbackState: "idle",
      currentQueueItemId: null,
      positionMs: 0,
    });
  } else {
    await bumpGeneration(sessionId, session.playbackGeneration, {
      playbackState: "playing",
      currentQueueItemId: next.id,
      positionMs: 0,
    });
  }

  const snapshot = await publish(sessionId, userId);
  if (!snapshot) throw new SessionError("Session not found", 404);
  return snapshot;
}

/** Sweep idle live sessions (call from periodic check or before list). */
export async function endIdleSessions(): Promise<number> {
  const live = await db.query.sessions.findMany({
    where: eq(schema.sessions.status, "live"),
  });
  let ended = 0;
  for (const s of live) {
    if (isSessionIdle(s.lastActivityAt)) {
      await endSessionInternal(s.id, "idle");
      ended += 1;
    }
  }
  return ended;
}

export async function findLiveSessionForUser(userId: string) {
  await endIdleSessions();
  const membership = await db.query.sessionMembers.findFirst({
    where: and(eq(schema.sessionMembers.userId, userId), isNull(schema.sessionMembers.leftAt)),
    orderBy: [desc(schema.sessionMembers.joinedAt)],
  });
  if (!membership) return null;
  const session = await db.query.sessions.findFirst({
    where: and(eq(schema.sessions.id, membership.sessionId), eq(schema.sessions.status, "live")),
  });
  return session ?? null;
}
