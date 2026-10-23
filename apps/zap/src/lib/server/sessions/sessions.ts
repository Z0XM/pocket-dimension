import { db, schema } from "@pocket-dimension/db";
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { PREVIOUS_RESTART_THRESHOLD_MS, insertionIndex, isPermutation, type EnqueueMode } from "$lib/catalog-queue";
import { pickAutoPlayTrack, type AutoPlayCandidate } from "$lib/server/autoplay";
import { isLiveSessionIdle } from "$lib/server/idle-session";
import { recordPlayEvent } from "$lib/server/play-history";
import { sessionEventBus } from "./event-bus";
import { generateJoinCode, normalizeJoinCode } from "./join-code";
import {
  canAddToQueue,
  canEndSession,
  canManageSetup,
  canPlayPause,
  canReorderQueue,
  canSeek,
  canSkip,
  type MemberPermissionRow,
} from "./permissions";
import { defaultSessionName, hostLabelForSession, normalizeSessionName } from "./session-name";
import { buildSessionSnapshot } from "./snapshot";
import type { SessionMemberPermissions, SessionSnapshot } from "./types";

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

function grantsOf(member: typeof schema.sessionMembers.$inferSelect): MemberPermissionRow {
  return {
    canAdd: member.canAdd,
    canPlayPause: member.canPlayPause,
    canSkip: member.canSkip,
    canSeek: member.canSeek,
    canReorder: member.canReorder,
    canSetup: member.canSetup,
  };
}

async function publish(sessionId: string, viewerUserId?: string | null) {
  const snapshot = await buildSessionSnapshot(sessionId, viewerUserId);
  if (snapshot) sessionEventBus.publish(sessionId, snapshot);
  return snapshot;
}

async function markStaleInternal(sessionId: string) {
  const now = new Date();
  let positionMs = 0;
  const session = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, sessionId) });
  if (session) {
    positionMs = session.positionMs;
    if (session.playbackState === "playing") {
      positionMs = Math.max(0, session.positionMs + (Date.now() - session.positionUpdatedAt.getTime()));
    }
  }
  await db
    .update(schema.sessions)
    .set({
      staleAt: now,
      playbackState: "paused",
      positionMs,
      positionUpdatedAt: now,
      lastActivityAt: now,
    })
    .where(and(eq(schema.sessions.id, sessionId), eq(schema.sessions.status, "live")));
  // Mark members left but keep rows so permission grants survive rejoin.
  await db
    .update(schema.sessionMembers)
    .set({ leftAt: now })
    .where(and(eq(schema.sessionMembers.sessionId, sessionId), isNull(schema.sessionMembers.leftAt)));
  const snapshot = await buildSessionSnapshot(sessionId);
  if (snapshot) sessionEventBus.publish(sessionId, snapshot);
  sessionEventBus.closeSession(sessionId);
  // Soft-disconnect Discord (keep channel selection for Reconnect); do not detach.
  void import("$lib/server/discord").then((m) => m.onSessionStale(sessionId)).catch(() => {});
  return snapshot;
}

async function requireLiveSession(sessionId: string) {
  const session = await db.query.sessions.findFirst({
    where: eq(schema.sessions.id, sessionId),
  });
  if (!session) throw new SessionError("Session not found", 404);
  if (session.status === "ended" || session.endedAt) throw new SessionError("Session has ended", 410);
  if (session.staleAt) throw new SessionError("Session is stale — rejoin to resume", 410);

  if (
    isLiveSessionIdle({
      lastActivityAt: session.lastActivityAt,
      playbackState: session.playbackState,
    })
  ) {
    if (session.perpetual) {
      await markStaleInternal(session.id);
      throw new SessionError("Session went stale due to inactivity", 410);
    }
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

async function endSessionInternal(sessionId: string, _reason: "host" | "idle" | "admin") {
  const now = new Date();
  await db
    .update(schema.sessions)
    .set({ status: "ended", endedAt: now, playbackState: "idle", staleAt: null })
    .where(and(eq(schema.sessions.id, sessionId), eq(schema.sessions.status, "live")));
  await db
    .update(schema.sessionMembers)
    .set({ leftAt: now })
    .where(and(eq(schema.sessionMembers.sessionId, sessionId), isNull(schema.sessionMembers.leftAt)));
  const snapshot = await buildSessionSnapshot(sessionId);
  if (snapshot) sessionEventBus.publish(sessionId, snapshot);
  sessionEventBus.closeSession(sessionId);
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

async function ensureActiveMember(sessionId: string, userId: string, role: "host" | "guest") {
  const active = await db.query.sessionMembers.findFirst({
    where: and(eq(schema.sessionMembers.sessionId, sessionId), eq(schema.sessionMembers.userId, userId), isNull(schema.sessionMembers.leftAt)),
  });
  if (active) return active;

  // Revive the most recent membership so permission grants persist across stale/rejoin.
  const prior = await db.query.sessionMembers.findFirst({
    where: and(eq(schema.sessionMembers.sessionId, sessionId), eq(schema.sessionMembers.userId, userId)),
    orderBy: [desc(schema.sessionMembers.joinedAt)],
  });
  if (prior) {
    const [revived] = await db
      .update(schema.sessionMembers)
      .set({ leftAt: null, role: prior.role === "host" || role === "host" ? "host" : prior.role, joinedAt: sql`now()` })
      .where(eq(schema.sessionMembers.id, prior.id))
      .returning();
    if (revived) return revived;
  }

  const [created] = await db
    .insert(schema.sessionMembers)
    .values({
      sessionId,
      userId,
      role,
    })
    .returning();
  if (!created) throw new SessionError("Failed to join session", 500);
  return created;
}

export async function createSession(
  hostUserId: string,
  opts?: { perpetual?: boolean; name?: string | null }
): Promise<SessionSnapshot> {
  const joinCode = await allocateJoinCode();
  const host = await db.query.user.findFirst({ where: eq(schema.user.id, hostUserId) });
  const hostLabel = host ? hostLabelForSession(host) : null;
  let name: string;
  try {
    name = normalizeSessionName(opts?.name) ?? defaultSessionName(joinCode, hostLabel);
  } catch (err) {
    throw new SessionError(err instanceof Error ? err.message : "Invalid session name");
  }
  const [session] = await db
    .insert(schema.sessions)
    .values({
      hostUserId,
      joinCode,
      name,
      status: "live",
      playbackState: "idle",
      perpetual: Boolean(opts?.perpetual),
    })
    .returning();

  if (!session) throw new SessionError("Failed to create session", 500);

  await db.insert(schema.sessionMembers).values({
    sessionId: session.id,
    userId: hostUserId,
    role: "host",
    canAdd: true,
    canPlayPause: true,
    canSkip: true,
    canSeek: true,
    canReorder: true,
    canSetup: true,
  });

  const snapshot = await buildSessionSnapshot(session.id, hostUserId);
  if (!snapshot) throw new SessionError("Failed to load session", 500);
  return snapshot;
}

/** Reactivate a stale perpetual session (or no-op if already live). */
export async function reactivateSession(sessionId: string, userId: string): Promise<SessionSnapshot> {
  const session = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, sessionId) });
  if (!session) throw new SessionError("Session not found", 404);
  if (session.status === "ended" || session.endedAt) throw new SessionError("Session has ended", 410);

  const isHost = session.hostUserId === userId;
  // Guests may rejoin if they have a prior membership (even after stale leftAt).
  const prior = await db.query.sessionMembers.findFirst({
    where: and(eq(schema.sessionMembers.sessionId, sessionId), eq(schema.sessionMembers.userId, userId)),
    orderBy: [desc(schema.sessionMembers.joinedAt)],
  });
  if (!isHost && !prior) throw new SessionError("Join the session first", 403);

  if (session.staleAt) {
    if (!session.perpetual) throw new SessionError("Session has ended", 410);
    await db
      .update(schema.sessions)
      .set({ staleAt: null, lastActivityAt: sql`now()`, endedAt: null })
      .where(eq(schema.sessions.id, sessionId));
  }

  await ensureActiveMember(sessionId, userId, isHost ? "host" : "guest");
  await touchActivity(sessionId);
  const snapshot = await publish(sessionId, userId);
  if (!snapshot) throw new SessionError("Failed to resume session", 500);
  return snapshot;
}

export async function joinSessionByCode(userId: string, rawCode: string): Promise<SessionSnapshot> {
  const joinCode = normalizeJoinCode(rawCode);
  if (!joinCode) throw new SessionError("Enter a join code");

  const session = await db.query.sessions.findFirst({
    where: and(eq(schema.sessions.joinCode, joinCode), eq(schema.sessions.status, "live")),
  });
  if (!session) throw new SessionError("No live session for that code", 404);

  if (session.staleAt) {
    if (!session.perpetual) throw new SessionError("Session has ended", 410);
    return reactivateSession(session.id, userId);
  }

  if (
    isLiveSessionIdle({
      lastActivityAt: session.lastActivityAt,
      playbackState: session.playbackState,
    })
  ) {
    if (session.perpetual) {
      await markStaleInternal(session.id);
      return reactivateSession(session.id, userId);
    }
    await endSessionInternal(session.id, "idle");
    throw new SessionError("Session ended due to inactivity", 410);
  }

  const role = session.hostUserId === userId ? "host" : "guest";
  await ensureActiveMember(session.id, userId, role);
  await touchActivity(session.id);
  const snapshot = await publish(session.id, userId);
  if (!snapshot) throw new SessionError("Failed to join", 500);
  return snapshot;
}

export async function getSessionForUser(sessionId: string, userId: string): Promise<SessionSnapshot> {
  const session = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, sessionId) });
  if (!session) throw new SessionError("Session not found", 404);
  if (session.staleAt && session.perpetual) {
    return reactivateSession(sessionId, userId);
  }
  await requireLiveSession(sessionId);
  await requireMember(sessionId, userId);
  const snapshot = await buildSessionSnapshot(sessionId, userId);
  if (!snapshot) throw new SessionError("Session not found", 404);
  return snapshot;
}

export async function endSession(sessionId: string, userId: string): Promise<SessionSnapshot | null> {
  const session = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, sessionId) });
  if (!session) throw new SessionError("Session not found", 404);
  if (session.status === "ended") {
    return buildSessionSnapshot(sessionId, userId);
  }
  const member =
    (await db.query.sessionMembers.findFirst({
      where: and(eq(schema.sessionMembers.sessionId, sessionId), eq(schema.sessionMembers.userId, userId), isNull(schema.sessionMembers.leftAt)),
    })) ??
    (await db.query.sessionMembers.findFirst({
      where: and(eq(schema.sessionMembers.sessionId, sessionId), eq(schema.sessionMembers.userId, userId)),
      orderBy: [desc(schema.sessionMembers.joinedAt)],
    }));
  if (!member || !canEndSession(member.role)) throw new SessionError("Only the host can end the session", 403);
  if (session.hostUserId !== userId && member.role !== "host") {
    throw new SessionError("Only the host can end the session", 403);
  }
  return endSessionInternal(sessionId, "host");
}

export async function setSessionOptions(
  sessionId: string,
  userId: string,
  flags: { autoPlay?: boolean; perpetual?: boolean; name?: string | null }
): Promise<SessionSnapshot> {
  const session = await requireLiveSession(sessionId);
  const member = await requireMember(sessionId, userId);
  if (!canManageSetup(member.role, grantsOf(member))) {
    throw new SessionError("You can't change session setup", 403);
  }
  // Only host can toggle perpetual (survives beyond setup grant).
  if (flags.perpetual !== undefined && member.role !== "host") {
    throw new SessionError("Only the host can change perpetual", 403);
  }

  let nextName: string | undefined;
  if (flags.name !== undefined) {
    try {
      nextName = normalizeSessionName(flags.name) ?? defaultSessionName(session.joinCode);
    } catch (err) {
      throw new SessionError(err instanceof Error ? err.message : "Invalid session name");
    }
  }

  await db
    .update(schema.sessions)
    .set({
      ...(flags.autoPlay !== undefined ? { autoPlay: flags.autoPlay } : {}),
      ...(flags.perpetual !== undefined ? { perpetual: flags.perpetual } : {}),
      ...(nextName !== undefined ? { name: nextName } : {}),
      lastActivityAt: sql`now()`,
    })
    .where(eq(schema.sessions.id, session.id));

  const snapshot = await publish(sessionId, userId);
  if (!snapshot) throw new SessionError("Session not found", 404);
  return snapshot;
}

/**
 * Rename a live or stale (perpetual) session from the sessions index.
 * Host or setup-capable members (including after stale leftAt).
 */
export async function renameSession(sessionId: string, userId: string, name: string | null | undefined): Promise<SessionSnapshot> {
  const session = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, sessionId) });
  if (!session) throw new SessionError("Session not found", 404);
  if (session.status === "ended" || session.endedAt) throw new SessionError("Session has ended", 410);

  const member =
    (await db.query.sessionMembers.findFirst({
      where: and(eq(schema.sessionMembers.sessionId, sessionId), eq(schema.sessionMembers.userId, userId), isNull(schema.sessionMembers.leftAt)),
    })) ??
    (await db.query.sessionMembers.findFirst({
      where: and(eq(schema.sessionMembers.sessionId, sessionId), eq(schema.sessionMembers.userId, userId)),
      orderBy: [desc(schema.sessionMembers.joinedAt)],
    }));

  const isHost = session.hostUserId === userId || member?.role === "host";
  const role = isHost ? ("host" as const) : (member?.role ?? null);
  const grants = member ? grantsOf(member) : null;
  if (!canManageSetup(role, grants)) {
    throw new SessionError("You can't rename this session", 403);
  }

  let nextName: string;
  try {
    nextName = normalizeSessionName(name) ?? defaultSessionName(session.joinCode);
  } catch (err) {
    throw new SessionError(err instanceof Error ? err.message : "Invalid session name");
  }

  await db
    .update(schema.sessions)
    .set({ name: nextName, lastActivityAt: sql`now()` })
    .where(eq(schema.sessions.id, session.id));

  const snapshot = await publish(sessionId, userId);
  if (!snapshot) throw new SessionError("Session not found", 404);
  return snapshot;
}

/** @deprecated Use setSessionOptions / setMemberPermissions. Kept for PATCH compat during rollout. */
export async function setGuestPermissions(
  sessionId: string,
  userId: string,
  flags: { guestsCanAdd?: boolean; guestsCanControl?: boolean; autoPlay?: boolean; perpetual?: boolean }
): Promise<SessionSnapshot> {
  if (flags.autoPlay !== undefined || flags.perpetual !== undefined) {
    await setSessionOptions(sessionId, userId, { autoPlay: flags.autoPlay, perpetual: flags.perpetual });
  }
  // Legacy session-wide guest toggles → apply to all current guests.
  if (flags.guestsCanAdd !== undefined || flags.guestsCanControl !== undefined) {
    const session = await requireLiveSession(sessionId);
    const member = await requireMember(sessionId, userId);
    if (!canManageSetup(member.role, grantsOf(member))) {
      throw new SessionError("You can't change guest permissions", 403);
    }
    const patch: Partial<MemberPermissionRow> = {};
    if (flags.guestsCanAdd !== undefined) {
      patch.canAdd = flags.guestsCanAdd;
      patch.canReorder = flags.guestsCanAdd || Boolean(flags.guestsCanControl ?? false);
    }
    if (flags.guestsCanControl !== undefined) {
      patch.canPlayPause = flags.guestsCanControl;
      patch.canSkip = flags.guestsCanControl;
      patch.canSeek = flags.guestsCanControl;
      if (flags.guestsCanAdd === undefined) {
        // leave canAdd alone; still bump reorder if control granted
        if (flags.guestsCanControl) patch.canReorder = true;
      }
    }
    await db
      .update(schema.sessionMembers)
      .set(patch)
      .where(and(eq(schema.sessionMembers.sessionId, session.id), eq(schema.sessionMembers.role, "guest"), isNull(schema.sessionMembers.leftAt)));
    await touchActivity(sessionId);
  }
  const snapshot = await publish(sessionId, userId);
  if (!snapshot) throw new SessionError("Session not found", 404);
  return snapshot;
}

export async function setMemberPermissions(
  sessionId: string,
  actorUserId: string,
  targetUserId: string,
  permissions: Partial<SessionMemberPermissions>
): Promise<SessionSnapshot> {
  await requireLiveSession(sessionId);
  const actor = await requireMember(sessionId, actorUserId);
  if (!canManageSetup(actor.role, grantsOf(actor))) {
    throw new SessionError("You can't change member permissions", 403);
  }
  const target = await requireMember(sessionId, targetUserId);
  if (target.role === "host") throw new SessionError("Host permissions can't be changed", 400);
  // Setup grant cannot escalate: only host can grant setup to others.
  if (permissions.canSetup !== undefined && actor.role !== "host") {
    throw new SessionError("Only the host can grant setup", 403);
  }

  await db
    .update(schema.sessionMembers)
    .set({
      ...(permissions.canAdd !== undefined ? { canAdd: permissions.canAdd } : {}),
      ...(permissions.canPlayPause !== undefined ? { canPlayPause: permissions.canPlayPause } : {}),
      ...(permissions.canSkip !== undefined ? { canSkip: permissions.canSkip } : {}),
      ...(permissions.canSeek !== undefined ? { canSeek: permissions.canSeek } : {}),
      ...(permissions.canReorder !== undefined ? { canReorder: permissions.canReorder } : {}),
      ...(permissions.canSetup !== undefined ? { canSetup: permissions.canSetup } : {}),
    })
    .where(eq(schema.sessionMembers.id, target.id));
  await touchActivity(sessionId);
  const snapshot = await publish(sessionId, actorUserId);
  if (!snapshot) throw new SessionError("Session not found", 404);
  return snapshot;
}

export async function setMemberOutput(
  sessionId: string,
  actorUserId: string,
  targetUserId: string,
  patch: { outputEnabled?: boolean; volume?: number }
): Promise<SessionSnapshot> {
  await requireLiveSession(sessionId);
  const actor = await requireMember(sessionId, actorUserId);
  const self = actorUserId === targetUserId;
  if (!self && !canManageSetup(actor.role, grantsOf(actor))) {
    throw new SessionError("You can't change another member's output", 403);
  }
  const target = await requireMember(sessionId, targetUserId);
  const volume =
    patch.volume !== undefined ? Math.max(0, Math.min(100, Math.round(patch.volume))) : undefined;

  await db
    .update(schema.sessionMembers)
    .set({
      ...(patch.outputEnabled !== undefined ? { outputEnabled: patch.outputEnabled } : {}),
      ...(volume !== undefined ? { volume } : {}),
    })
    .where(eq(schema.sessionMembers.id, target.id));
  await touchActivity(sessionId);
  const snapshot = await publish(sessionId, actorUserId);
  if (!snapshot) throw new SessionError("Session not found", 404);
  return snapshot;
}

async function insertQueueItems(
  sessionId: string,
  userId: string,
  mediaAssetIds: string[],
  mode: EnqueueMode
): Promise<{ firstId: string | null }> {
  const playable = await db.query.mediaAssets.findMany({
    where: and(inArray(schema.mediaAssets.id, mediaAssetIds), eq(schema.mediaAssets.status, "ready"), isNotNull(schema.mediaAssets.storageKey)),
  });
  const playableSet = new Set(playable.map((a) => a.id));
  const ordered = mediaAssetIds.filter((id) => playableSet.has(id));
  if (ordered.length === 0) throw new SessionError("Track not playable", 400);

  const existing = await db.query.queueItems.findMany({
    where: eq(schema.queueItems.sessionId, sessionId),
    orderBy: [asc(schema.queueItems.position)],
  });
  const session = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, sessionId) });
  if (!session) throw new SessionError("Session not found", 404);

  const at = insertionIndex(
    existing.map((i) => ({ id: i.id, source: "last" })),
    session.currentQueueItemId,
    mode
  );

  // Shift positions at/after insert point
  if (at < existing.length) {
    for (let i = existing.length - 1; i >= at; i--) {
      await db
        .update(schema.queueItems)
        .set({ position: i + ordered.length })
        .where(eq(schema.queueItems.id, existing[i]!.id));
    }
  }

  const inserted: string[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const [row] = await db
      .insert(schema.queueItems)
      .values({
        sessionId,
        mediaAssetId: ordered[i]!,
        position: at + i,
        addedByUserId: userId,
      })
      .returning();
    if (row) inserted.push(row.id);
  }
  return { firstId: inserted[0] ?? null };
}

export async function enqueueCatalogueTrack(
  sessionId: string,
  userId: string,
  mediaAssetId: string,
  mode: EnqueueMode = "last"
): Promise<SessionSnapshot> {
  const session = await requireLiveSession(sessionId);
  const member = await requireMember(sessionId, userId);
  const grants = grantsOf(member);
  if (mode === "play") {
    if (!canAddToQueue(member.role, grants) && !canPlayPause(member.role, grants)) {
      throw new SessionError("You can't play tracks", 403);
    }
  } else if (!canAddToQueue(member.role, grants)) {
    throw new SessionError("You can't add to the queue (listen-only)", 403);
  }

  const { firstId } = await insertQueueItems(sessionId, userId, [mediaAssetId], mode);

  if (mode === "play" && firstId) {
    await bumpGeneration(sessionId, session.playbackGeneration, {
      playbackState: "playing",
      currentQueueItemId: firstId,
      positionMs: 0,
    });
    await recordPlayEvent({ userId, sessionId, mediaAssetId });
  } else if (session.playbackState === "idle" && !session.currentQueueItemId && firstId) {
    await bumpGeneration(sessionId, session.playbackGeneration, {
      playbackState: "playing",
      currentQueueItemId: firstId,
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

export async function enqueueCatalogueTracks(
  sessionId: string,
  userId: string,
  mediaAssetIds: string[],
  mode: EnqueueMode = "last"
): Promise<SessionSnapshot> {
  if (mediaAssetIds.length === 0) throw new SessionError("No tracks", 400);
  if (mediaAssetIds.length === 1) return enqueueCatalogueTrack(sessionId, userId, mediaAssetIds[0]!, mode);

  const session = await requireLiveSession(sessionId);
  const member = await requireMember(sessionId, userId);
  const grants = grantsOf(member);
  if (!canAddToQueue(member.role, grants)) {
    throw new SessionError("You can't add to the queue (listen-only)", 403);
  }

  const { firstId } = await insertQueueItems(sessionId, userId, mediaAssetIds, mode);
  if (mode === "play" && firstId && canPlayPause(member.role, grants)) {
    const item = await db.query.queueItems.findFirst({ where: eq(schema.queueItems.id, firstId) });
    await bumpGeneration(sessionId, session.playbackGeneration, {
      playbackState: "playing",
      currentQueueItemId: firstId,
      positionMs: 0,
    });
    if (item) await recordPlayEvent({ userId, sessionId, mediaAssetId: item.mediaAssetId });
  } else if (session.playbackState === "idle" && !session.currentQueueItemId && firstId) {
    const item = await db.query.queueItems.findFirst({ where: eq(schema.queueItems.id, firstId) });
    await bumpGeneration(sessionId, session.playbackGeneration, {
      playbackState: "playing",
      currentQueueItemId: firstId,
      positionMs: 0,
    });
    if (item) await recordPlayEvent({ userId, sessionId, mediaAssetId: item.mediaAssetId });
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
  if (!canPlayPause(member.role, grantsOf(member))) {
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
  if (!canPlayPause(member.role, grantsOf(member))) {
    throw new SessionError("You can't control playback", 403);
  }

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
  if (!canSeek(member.role, grantsOf(member))) {
    throw new SessionError("You can't seek", 403);
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

/** Jump playhead to a queue item (click-to-play). */
export async function playQueueItem(sessionId: string, userId: string, queueItemId: string): Promise<SessionSnapshot> {
  const session = await requireLiveSession(sessionId);
  const member = await requireMember(sessionId, userId);
  if (!canPlayPause(member.role, grantsOf(member))) {
    throw new SessionError("You can't control playback", 403);
  }
  const item = await db.query.queueItems.findFirst({
    where: and(eq(schema.queueItems.id, queueItemId), eq(schema.queueItems.sessionId, sessionId)),
  });
  if (!item) throw new SessionError("Queue item not found", 404);

  await bumpGeneration(sessionId, session.playbackGeneration, {
    playbackState: "playing",
    currentQueueItemId: item.id,
    positionMs: 0,
  });
  await recordPlayEvent({ userId, sessionId, mediaAssetId: item.mediaAssetId });
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
  opts: { allowEmptyQueue: boolean; delta?: 1 | -1 }
): Promise<SessionSnapshot> {
  const delta = opts.delta ?? 1;
  const queue = await db.query.queueItems.findMany({
    where: eq(schema.queueItems.sessionId, sessionId),
    orderBy: [asc(schema.queueItems.position)],
  });
  if (queue.length === 0 && !opts.allowEmptyQueue) throw new SessionError("Queue is empty", 400);

  const idx = session.currentQueueItemId ? queue.findIndex((q) => q.id === session.currentQueueItemId) : -1;
  const next = queue[idx + delta] ?? null;

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

  if (delta < 0) {
    // Already at first track — restart it.
    if (session.currentQueueItemId) {
      await bumpGeneration(sessionId, session.playbackGeneration, {
        playbackState: "playing",
        currentQueueItemId: session.currentQueueItemId,
        positionMs: 0,
      });
      const snapshot = await publish(sessionId, userId);
      if (!snapshot) throw new SessionError("Session not found", 404);
      return snapshot;
    }
    throw new SessionError("Queue is empty", 400);
  }

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
  if (!canSkip(member.role, grantsOf(member))) {
    throw new SessionError("You can't skip", 403);
  }
  return advanceOrAutoPlay(sessionId, userId, session, { allowEmptyQueue: false });
}

/** Previous track, or restart current if played past the threshold. */
export async function previous(sessionId: string, userId: string): Promise<SessionSnapshot> {
  const session = await requireLiveSession(sessionId);
  const member = await requireMember(sessionId, userId);
  if (!canSkip(member.role, grantsOf(member))) {
    throw new SessionError("You can't skip", 403);
  }

  let positionMs = session.positionMs;
  if (session.playbackState === "playing") {
    positionMs = Math.max(0, session.positionMs + (Date.now() - session.positionUpdatedAt.getTime()));
  }
  if (positionMs > PREVIOUS_RESTART_THRESHOLD_MS && session.currentQueueItemId) {
    await bumpGeneration(sessionId, session.playbackGeneration, {
      playbackState: "playing",
      positionMs: 0,
      currentQueueItemId: session.currentQueueItemId,
    });
    const snapshot = await publish(sessionId, userId);
    if (!snapshot) throw new SessionError("Session not found", 404);
    return snapshot;
  }

  return advanceOrAutoPlay(sessionId, userId, session, { allowEmptyQueue: false, delta: -1 });
}

export async function onTrackEnded(sessionId: string, userId: string): Promise<SessionSnapshot> {
  const session = await requireLiveSession(sessionId);
  const member = await requireMember(sessionId, userId);
  // Auto-advance: prefer skip grant; fall back to playPause so host/control users still advance.
  if (!canSkip(member.role, grantsOf(member)) && !canPlayPause(member.role, grantsOf(member))) {
    throw new SessionError("You can't control playback", 403);
  }
  return advanceOrAutoPlay(sessionId, userId, session, { allowEmptyQueue: true });
}

export async function removeQueueItem(sessionId: string, userId: string, queueItemId: string): Promise<SessionSnapshot> {
  const session = await requireLiveSession(sessionId);
  const member = await requireMember(sessionId, userId);
  const grants = grantsOf(member);
  if (!canReorderQueue(member.role, grants) && !canAddToQueue(member.role, grants)) {
    throw new SessionError("You can't change the queue", 403);
  }

  const item = await db.query.queueItems.findFirst({
    where: and(eq(schema.queueItems.id, queueItemId), eq(schema.queueItems.sessionId, sessionId)),
  });
  if (!item) throw new SessionError("Queue item not found", 404);

  const wasCurrent = session.currentQueueItemId === item.id;
  await db.delete(schema.queueItems).where(eq(schema.queueItems.id, item.id));

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
  const grants = grantsOf(member);
  if (!canReorderQueue(member.role, grants) && !canAddToQueue(member.role, grants)) {
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

export async function moveQueueItem(sessionId: string, userId: string, queueItemId: string, direction: "up" | "down"): Promise<SessionSnapshot> {
  const session = await requireLiveSession(sessionId);
  const member = await requireMember(sessionId, userId);
  if (!canReorderQueue(member.role, grantsOf(member))) {
    throw new SessionError("You can't reorder the queue", 403);
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
  const temp = 1_000_000 + a.position;
  await db.update(schema.queueItems).set({ position: temp }).where(eq(schema.queueItems.id, a.id));
  await db.update(schema.queueItems).set({ position: a.position }).where(eq(schema.queueItems.id, b.id));
  await db.update(schema.queueItems).set({ position: b.position }).where(eq(schema.queueItems.id, a.id));
  await touchActivity(sessionId);

  const snapshot = await publish(sessionId, userId);
  if (!snapshot) throw new SessionError("Session not found", 404);
  return snapshot;
}

/** DnD reorder — `orderedIds` must be a permutation of current queue item ids. */
export async function reorderQueue(sessionId: string, userId: string, orderedIds: string[]): Promise<SessionSnapshot> {
  await requireLiveSession(sessionId);
  const member = await requireMember(sessionId, userId);
  if (!canReorderQueue(member.role, grantsOf(member))) {
    throw new SessionError("You can't reorder the queue", 403);
  }

  const queue = await db.query.queueItems.findMany({
    where: eq(schema.queueItems.sessionId, sessionId),
    orderBy: [asc(schema.queueItems.position)],
  });
  const currentIds = queue.map((q) => q.id);
  if (!isPermutation(currentIds, orderedIds)) {
    throw new SessionError("Invalid queue order", 400);
  }

  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i]!;
    const row = queue.find((q) => q.id === id)!;
    if (row.position !== i) {
      await db.update(schema.queueItems).set({ position: 2_000_000 + i }).where(eq(schema.queueItems.id, id));
    }
  }
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(schema.queueItems).set({ position: i }).where(eq(schema.queueItems.id, orderedIds[i]!));
  }
  await touchActivity(sessionId);

  const snapshot = await publish(sessionId, userId);
  if (!snapshot) throw new SessionError("Session not found", 404);
  return snapshot;
}

export async function endIdleSessions(): Promise<number> {
  const live = await db.query.sessions.findMany({
    where: eq(schema.sessions.status, "live"),
  });
  let changed = 0;
  for (const s of live) {
    if (
      isLiveSessionIdle({
        lastActivityAt: s.lastActivityAt,
        playbackState: s.playbackState,
      })
    ) {
      if (s.perpetual) {
        await markStaleInternal(s.id);
      } else {
        await endSessionInternal(s.id, "idle");
      }
      changed += 1;
    }
  }
  return changed;
}

export async function removeUserFromLiveSessions(userId: string): Promise<{ endedSessions: number; leftSessions: number }> {
  const hosted = await db.query.sessions.findMany({
    where: and(eq(schema.sessions.hostUserId, userId), eq(schema.sessions.status, "live")),
  });
  for (const s of hosted) {
    await endSessionInternal(s.id, "admin");
  }

  const left = await db
    .update(schema.sessionMembers)
    .set({ leftAt: new Date() })
    .where(and(eq(schema.sessionMembers.userId, userId), isNull(schema.sessionMembers.leftAt)))
    .returning({ sessionId: schema.sessionMembers.sessionId });
  const leftSessionIds = [...new Set(left.map((r) => r.sessionId))];
  await publishSessionSnapshots(leftSessionIds);

  return { endedSessions: hosted.length, leftSessions: leftSessionIds.length };
}

export async function publishSessionSnapshots(sessionIds: string[]) {
  if (sessionIds.length === 0) return;
  const rows = await db
    .select({ id: schema.sessions.id, hostUserId: schema.sessions.hostUserId })
    .from(schema.sessions)
    .where(inArray(schema.sessions.id, sessionIds));
  for (const row of rows) {
    await publish(row.id, row.hostUserId);
  }
}

export type LiveSessionSummary = {
  id: string;
  joinCode: string;
  name: string;
  role: "host" | "guest";
  playbackState: "idle" | "playing" | "paused";
  positionMs: number;
  currentTitle: string | null;
  hostUserId: string;
  lastActivityAt: string;
  perpetual: boolean;
  status: "live" | "stale";
  /** Host or setup grant — rename from the sessions index. */
  canRename: boolean;
  /** Host only — end/close from the sessions index. */
  canClose: boolean;
};

function sessionIndexStatus(s: { staleAt: Date | null }): "live" | "stale" {
  return s.staleAt ? "stale" : "live";
}


async function summarizeSessionsForUser(
  userId: string,
  sessions: (typeof schema.sessions.$inferSelect)[],
  memberships: (typeof schema.sessionMembers.$inferSelect)[]
): Promise<LiveSessionSummary[]> {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const roleBySession = new Map(memberships.map((m) => [m.sessionId, m.role]));

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
    if (s.status !== "live") continue;
    const assetId = s.currentQueueItemId ? assetByQueueItem.get(s.currentQueueItemId) : null;
    const role = roleBySession.get(s.id) ?? m.role;
    const isHost = role === "host" || s.hostUserId === userId;
    const grants = grantsOf(m);
    out.push({
      id: s.id,
      joinCode: s.joinCode,
      name: s.name?.trim() ? s.name : defaultSessionName(s.joinCode),
      role: isHost ? "host" : role,
      playbackState: s.playbackState,
      positionMs: s.positionMs,
      currentTitle: assetId ? (titleByAsset.get(assetId) ?? null) : null,
      hostUserId: s.hostUserId,
      lastActivityAt: s.lastActivityAt.toISOString(),
      perpetual: s.perpetual,
      status: sessionIndexStatus(s),
      canRename: canManageSetup(isHost ? "host" : role, grants),
      canClose: canEndSession(isHost ? "host" : role),
    });
  }
  return out;
}

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
      isNull(schema.sessions.staleAt),
      inArray(
        schema.sessions.id,
        memberships.map((m) => m.sessionId)
      )
    ),
  });
  return summarizeSessionsForUser(userId, sessions, memberships);
}

/** Live memberships plus the user's perpetual sessions (including stale) for the sessions index. */
export async function listSessionsIndexForUser(userId: string): Promise<LiveSessionSummary[]> {
  await endIdleSessions();

  const activeMemberships = await db.query.sessionMembers.findMany({
    where: and(eq(schema.sessionMembers.userId, userId), isNull(schema.sessionMembers.leftAt)),
    orderBy: [desc(schema.sessionMembers.joinedAt)],
  });

  const perpetualHosted = await db.query.sessions.findMany({
    where: and(eq(schema.sessions.hostUserId, userId), eq(schema.sessions.perpetual, true), eq(schema.sessions.status, "live")),
  });

  const allMemberships = await db.query.sessionMembers.findMany({
    where: eq(schema.sessionMembers.userId, userId),
    orderBy: [desc(schema.sessionMembers.joinedAt)],
  });
  const latestMembershipBySession = new Map<string, (typeof allMemberships)[number]>();
  for (const m of allMemberships) {
    if (!latestMembershipBySession.has(m.sessionId)) latestMembershipBySession.set(m.sessionId, m);
  }

  const perpetualGuestIds = [...latestMembershipBySession.keys()];
  const perpetualGuestSessions =
    perpetualGuestIds.length === 0
      ? []
      : await db.query.sessions.findMany({
          where: and(
            inArray(schema.sessions.id, perpetualGuestIds),
            eq(schema.sessions.perpetual, true),
            eq(schema.sessions.status, "live")
          ),
        });

  const sessionById = new Map<string, (typeof perpetualHosted)[number]>();
  for (const s of perpetualHosted) sessionById.set(s.id, s);
  for (const s of perpetualGuestSessions) sessionById.set(s.id, s);

  // Active (non-stale) live rooms the user is in right now.
  const liveActive =
    activeMemberships.length === 0
      ? []
      : await db.query.sessions.findMany({
          where: and(
            eq(schema.sessions.status, "live"),
            isNull(schema.sessions.staleAt),
            inArray(
              schema.sessions.id,
              activeMemberships.map((m) => m.sessionId)
            )
          ),
        });
  for (const s of liveActive) sessionById.set(s.id, s);

  if (sessionById.size === 0) return [];

  const membershipBySession = new Map<string, typeof schema.sessionMembers.$inferSelect>();
  for (const [sid, m] of latestMembershipBySession) {
    if (sessionById.has(sid)) membershipBySession.set(sid, m);
  }
  for (const s of perpetualHosted) {
    if (!membershipBySession.has(s.id)) {
      membershipBySession.set(s.id, {
        id: s.id,
        sessionId: s.id,
        userId,
        role: "host",
        canAdd: true,
        canPlayPause: true,
        canSkip: true,
        canSeek: true,
        canReorder: true,
        canSetup: true,
        outputEnabled: true,
        volume: 100,
        joinedAt: s.createdAt,
        leftAt: null,
      });
    }
  }

  return summarizeSessionsForUser(userId, [...sessionById.values()], [...membershipBySession.values()]);
}

export async function findLiveSessionForUser(userId: string) {
  const list = await listLiveSessionsForUser(userId);
  if (list.length === 0) return null;
  const preferred = list.find((s) => s.role === "host") ?? list[0]!;
  return db.query.sessions.findFirst({
    where: and(eq(schema.sessions.id, preferred.id), eq(schema.sessions.status, "live"), isNull(schema.sessions.staleAt)),
  });
}
