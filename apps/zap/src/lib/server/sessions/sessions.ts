import { db, schema } from "@pocket-dimension/db";
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { pickAutoPlayTrack, type AutoPlayCandidate } from "$lib/server/autoplay";
import { isLiveSessionIdle } from "$lib/server/idle-session";
import { recordPlayEvent } from "$lib/server/play-history";
import { sessionEventBus } from "./event-bus";
import { generateJoinCode, normalizeJoinCode } from "./join-code";
import { canAddToQueue, canControlTransport, canEndSession, canManageGuestPermissions } from "./permissions";
import { buildSessionSnapshot } from "./snapshot";
import type { SessionSnapshot } from "./types";

async function recordCurrentTrackPlay(sessionId: string, userId: string, queueItemId: string | null | undefined) {
  if (!queueItemId) return;
  const item = await db.query.queueItems.findFirst({
    where: eq(schema.queueItems.id, queueItemId),
  });
  if (!item) return;
  await recordPlayEvent({ userId, sessionId, mediaAssetId: item.mediaAssetId });
}

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

  if (
    isLiveSessionIdle({
      lastActivityAt: session.lastActivityAt,
      playbackState: session.playbackState,
    })
  ) {
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

  if (
    isLiveSessionIdle({
      lastActivityAt: session.lastActivityAt,
      playbackState: session.playbackState,
    })
  ) {
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
  flags: { guestsCanAdd?: boolean; guestsCanControl?: boolean; autoPlay?: boolean }
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
      ...(flags.autoPlay !== undefined ? { autoPlay: flags.autoPlay } : {}),
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
    await recordPlayEvent({ userId, sessionId, mediaAssetId });
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

  const startingFresh = session.currentQueueItemId !== currentId || session.playbackState !== "playing";

  await bumpGeneration(sessionId, session.playbackGeneration, {
    playbackState: "playing",
    currentQueueItemId: currentId,
    positionMs: session.currentQueueItemId === currentId ? session.positionMs : 0,
  });

  if (startingFresh) {
    await recordCurrentTrackPlay(sessionId, userId, currentId);
  }

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

async function resolveAutoPlayAssetId(sessionId: string, hostUserId: string, queueAssetIds: string[]): Promise<string | null> {
  const recentPlays = await db.query.playEvents.findMany({
    where: eq(schema.playEvents.userId, hostUserId),
    orderBy: [desc(schema.playEvents.playedAt)],
    limit: 40,
  });
  const exclude = new Set<string>([...queueAssetIds, ...recentPlays.slice(0, 12).map((p) => p.mediaAssetId)]);

  // Seed tags from queue assets (host's tags).
  const seedTagRows =
    queueAssetIds.length === 0
      ? []
      : await db
          .select({ tagId: schema.mediaAssetTags.tagId })
          .from(schema.mediaAssetTags)
          .where(and(eq(schema.mediaAssetTags.userId, hostUserId), inArray(schema.mediaAssetTags.mediaAssetId, queueAssetIds)));
  const seedTagIds = [...new Set(seedTagRows.map((r) => r.tagId))];

  const candidates = await db
    .select({
      id: schema.mediaAssets.id,
      title: schema.mediaAssets.title,
      addedByUserId: schema.mediaAssets.addedByUserId,
    })
    .from(schema.mediaAssets)
    .where(and(eq(schema.mediaAssets.status, "ready"), isNotNull(schema.mediaAssets.storageKey)))
    .orderBy(desc(schema.mediaAssets.createdAt))
    .limit(120);

  const candidateIds = candidates.map((c) => c.id).filter((id) => !exclude.has(id));
  if (candidateIds.length === 0) return null;

  const tagLinks = await db
    .select({
      mediaAssetId: schema.mediaAssetTags.mediaAssetId,
      tagId: schema.mediaAssetTags.tagId,
    })
    .from(schema.mediaAssetTags)
    .where(and(eq(schema.mediaAssetTags.userId, hostUserId), inArray(schema.mediaAssetTags.mediaAssetId, candidateIds)));

  const tagsByAsset = new Map<string, string[]>();
  for (const link of tagLinks) {
    const list = tagsByAsset.get(link.mediaAssetId) ?? [];
    list.push(link.tagId);
    tagsByAsset.set(link.mediaAssetId, list);
  }

  const lastPlayByAsset = new Map<string, number>();
  for (const p of recentPlays) {
    if (!lastPlayByAsset.has(p.mediaAssetId)) lastPlayByAsset.set(p.mediaAssetId, p.playedAt.getTime());
  }
  const now = Date.now();

  const scored: AutoPlayCandidate[] = candidates
    .filter((c) => !exclude.has(c.id))
    .map((c) => {
      const last = lastPlayByAsset.get(c.id);
      return {
        id: c.id,
        title: c.title,
        tagIds: tagsByAsset.get(c.id) ?? [],
        msSinceLastPlay: last == null ? Number.POSITIVE_INFINITY : Math.max(0, now - last),
        addedByOther: Boolean(c.addedByUserId && c.addedByUserId !== hostUserId),
      };
    });

  const pick = pickAutoPlayTrack(scored, { seedTagIds, excludeAssetIds: exclude });
  return pick?.id ?? null;
}

async function advanceOrAutoPlay(
  sessionId: string,
  userId: string,
  session: typeof schema.sessions.$inferSelect,
  opts: { allowEmptyQueue: boolean }
): Promise<SessionSnapshot> {
  const queue = await db.query.queueItems.findMany({
    where: eq(schema.queueItems.sessionId, sessionId),
    orderBy: [asc(schema.queueItems.position)],
  });
  if (queue.length === 0 && !opts.allowEmptyQueue) throw new SessionError("Queue is empty", 400);

  const idx = session.currentQueueItemId ? queue.findIndex((q) => q.id === session.currentQueueItemId) : -1;
  const next = queue[idx + 1] ?? null;

  if (next) {
    await bumpGeneration(sessionId, session.playbackGeneration, {
      playbackState: "playing",
      currentQueueItemId: next.id,
      positionMs: 0,
    });
    await recordPlayEvent({ userId, sessionId, mediaAssetId: next.mediaAssetId });
    const snapshot = await publish(sessionId, userId);
    if (!snapshot) throw new SessionError("Session not found", 404);
    return snapshot;
  }

  // Queue exhausted — optional auto-play
  if (session.autoPlay) {
    const assetId = await resolveAutoPlayAssetId(
      sessionId,
      session.hostUserId,
      queue.map((q) => q.mediaAssetId)
    );
    if (assetId) {
      const last = queue[queue.length - 1];
      const position = (last?.position ?? -1) + 1;
      const [item] = await db
        .insert(schema.queueItems)
        .values({
          sessionId,
          mediaAssetId: assetId,
          position,
          addedByUserId: userId,
        })
        .returning();
      if (item) {
        await bumpGeneration(sessionId, session.playbackGeneration, {
          playbackState: "playing",
          currentQueueItemId: item.id,
          positionMs: 0,
        });
        await recordPlayEvent({ userId, sessionId, mediaAssetId: assetId });
        const snapshot = await publish(sessionId, userId);
        if (!snapshot) throw new SessionError("Session not found", 404);
        return snapshot;
      }
    }
  }

  await bumpGeneration(sessionId, session.playbackGeneration, {
    playbackState: "idle",
    currentQueueItemId: null,
    positionMs: 0,
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
  return advanceOrAutoPlay(sessionId, userId, session, { allowEmptyQueue: false });
}

/** Client reports current track finished — advance queue or auto-play. */
export async function onTrackEnded(sessionId: string, userId: string): Promise<SessionSnapshot> {
  const session = await requireLiveSession(sessionId);
  const member = await requireMember(sessionId, userId);
  if (!canControlTransport(member.role, { guestsCanAdd: session.guestsCanAdd, guestsCanControl: session.guestsCanControl })) {
    throw new SessionError("You can't control playback", 403);
  }
  return advanceOrAutoPlay(sessionId, userId, session, { allowEmptyQueue: true });
}

export async function removeQueueItem(sessionId: string, userId: string, queueItemId: string): Promise<SessionSnapshot> {
  const session = await requireLiveSession(sessionId);
  const member = await requireMember(sessionId, userId);
  const flags = { guestsCanAdd: session.guestsCanAdd, guestsCanControl: session.guestsCanControl };
  if (!canAddToQueue(member.role, flags) && !canControlTransport(member.role, flags)) {
    throw new SessionError("You can't change the queue", 403);
  }

  const item = await db.query.queueItems.findFirst({
    where: and(eq(schema.queueItems.id, queueItemId), eq(schema.queueItems.sessionId, sessionId)),
  });
  if (!item) throw new SessionError("Queue item not found", 404);

  const wasCurrent = session.currentQueueItemId === item.id;
  await db.delete(schema.queueItems).where(eq(schema.queueItems.id, item.id));

  // Compact positions after removal
  const remaining = await db.query.queueItems.findMany({
    where: eq(schema.queueItems.sessionId, sessionId),
    orderBy: [asc(schema.queueItems.position)],
  });
  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i]!.position !== i) {
      await db.update(schema.queueItems).set({ position: i }).where(eq(schema.queueItems.id, remaining[i]!.id));
    }
  }

  if (wasCurrent) {
    const next = remaining[0] ?? null;
    if (!next) {
      await bumpGeneration(sessionId, session.playbackGeneration, {
        playbackState: "idle",
        currentQueueItemId: null,
        positionMs: 0,
      });
    } else {
      await bumpGeneration(sessionId, session.playbackGeneration, {
        playbackState: session.playbackState === "idle" ? "paused" : session.playbackState,
        currentQueueItemId: next.id,
        positionMs: 0,
      });
    }
  } else {
    await touchActivity(sessionId);
  }

  const snapshot = await publish(sessionId, userId);
  if (!snapshot) throw new SessionError("Session not found", 404);
  return snapshot;
}

export async function clearQueue(sessionId: string, userId: string): Promise<SessionSnapshot> {
  const session = await requireLiveSession(sessionId);
  const member = await requireMember(sessionId, userId);
  const flags = { guestsCanAdd: session.guestsCanAdd, guestsCanControl: session.guestsCanControl };
  if (!canAddToQueue(member.role, flags) && !canControlTransport(member.role, flags)) {
    throw new SessionError("You can't change the queue", 403);
  }

  await db.delete(schema.queueItems).where(eq(schema.queueItems.sessionId, sessionId));
  await bumpGeneration(sessionId, session.playbackGeneration, {
    playbackState: "idle",
    currentQueueItemId: null,
    positionMs: 0,
  });

  const snapshot = await publish(sessionId, userId);
  if (!snapshot) throw new SessionError("Session not found", 404);
  return snapshot;
}

/** Move a queue item one step up or down. */
export async function moveQueueItem(sessionId: string, userId: string, queueItemId: string, direction: "up" | "down"): Promise<SessionSnapshot> {
  const session = await requireLiveSession(sessionId);
  const member = await requireMember(sessionId, userId);
  const flags = { guestsCanAdd: session.guestsCanAdd, guestsCanControl: session.guestsCanControl };
  if (!canAddToQueue(member.role, flags) && !canControlTransport(member.role, flags)) {
    throw new SessionError("You can't change the queue", 403);
  }

  const queue = await db.query.queueItems.findMany({
    where: eq(schema.queueItems.sessionId, sessionId),
    orderBy: [asc(schema.queueItems.position)],
  });
  const idx = queue.findIndex((q) => q.id === queueItemId);
  if (idx < 0) throw new SessionError("Queue item not found", 404);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= queue.length) {
    await touchActivity(sessionId);
    const snapshot = await publish(sessionId, userId);
    if (!snapshot) throw new SessionError("Session not found", 404);
    return snapshot;
  }

  const a = queue[idx]!;
  const b = queue[swapIdx]!;
  // Swap via temporary high position to avoid unique constraint clashes
  const temp = 1_000_000 + a.position;
  await db.update(schema.queueItems).set({ position: temp }).where(eq(schema.queueItems.id, a.id));
  await db.update(schema.queueItems).set({ position: a.position }).where(eq(schema.queueItems.id, b.id));
  await db.update(schema.queueItems).set({ position: b.position }).where(eq(schema.queueItems.id, a.id));
  await touchActivity(sessionId);

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
    if (
      isLiveSessionIdle({
        lastActivityAt: s.lastActivityAt,
        playbackState: s.playbackState,
      })
    ) {
      await endSessionInternal(s.id, "idle");
      ended += 1;
    }
  }
  return ended;
}

export type LiveSessionSummary = {
  id: string;
  joinCode: string;
  role: "host" | "guest";
  playbackState: "idle" | "playing" | "paused";
  positionMs: number;
  currentTitle: string | null;
  hostUserId: string;
  lastActivityAt: string;
};

export async function listLiveSessionsForUser(userId: string): Promise<LiveSessionSummary[]> {
  await endIdleSessions();
  const memberships = await db.query.sessionMembers.findMany({
    where: and(eq(schema.sessionMembers.userId, userId), isNull(schema.sessionMembers.leftAt)),
    orderBy: [desc(schema.sessionMembers.joinedAt)],
  });
  if (memberships.length === 0) return [];

  const sessions = await db.query.sessions.findMany({
    where: and(
      eq(schema.sessions.status, "live"),
      inArray(
        schema.sessions.id,
        memberships.map((m) => m.sessionId)
      )
    ),
  });
  const byId = new Map(sessions.map((s) => [s.id, s]));

  const currentIds = sessions.map((s) => s.currentQueueItemId).filter((id): id is string => Boolean(id));
  const queueItems =
    currentIds.length > 0
      ? await db.query.queueItems.findMany({
          where: inArray(schema.queueItems.id, currentIds),
        })
      : [];
  const assetIds = [...new Set(queueItems.map((q) => q.mediaAssetId))];
  const assets =
    assetIds.length > 0
      ? await db.query.mediaAssets.findMany({
          where: inArray(schema.mediaAssets.id, assetIds),
        })
      : [];
  const titleByAsset = new Map(assets.map((a) => [a.id, a.title]));
  const assetByQueueItem = new Map(queueItems.map((q) => [q.id, q.mediaAssetId]));

  const out: LiveSessionSummary[] = [];
  for (const m of memberships) {
    const s = byId.get(m.sessionId);
    if (!s) continue;
    const assetId = s.currentQueueItemId ? assetByQueueItem.get(s.currentQueueItemId) : null;
    out.push({
      id: s.id,
      joinCode: s.joinCode,
      role: m.role,
      playbackState: s.playbackState,
      positionMs: s.positionMs,
      currentTitle: assetId ? (titleByAsset.get(assetId) ?? null) : null,
      hostUserId: s.hostUserId,
      lastActivityAt: s.lastActivityAt.toISOString(),
    });
  }
  return out;
}

export async function findLiveSessionForUser(userId: string) {
  const list = await listLiveSessionsForUser(userId);
  if (list.length === 0) return null;
  const preferred = list.find((s) => s.role === "host") ?? list[0]!;
  return db.query.sessions.findFirst({
    where: and(eq(schema.sessions.id, preferred.id), eq(schema.sessions.status, "live")),
  });
}
