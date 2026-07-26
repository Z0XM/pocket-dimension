import { db, schema } from "@pocket-dimension/db";
import { and, asc, desc, eq, gt, gte, isNull, lt, sql } from "drizzle-orm";
import { listOpenParticipants } from "$lib/server/rooms";
import { listeningEventBus } from "./event-bus";
import { buildListeningSnapshot, buildListeningSnapshotForRoom } from "./snapshot";
import { listeningWorkerBridge } from "./worker-bridge";
import type { ListeningQueueSource, ListeningSnapshot } from "./types";

const QUEUE_LIMIT = 50;
const AUTO_SKIP_DELAY_MS = 3_000;

type RoomLike = { id: string; hostUserId: string; livekitRoomName: string };
type ListeningSession = typeof schema.listeningSessions.$inferSelect;

function codedError(code: string) {
  return Object.assign(new Error(code), { code });
}

function estimatedPositionMs(session: ListeningSession, at = new Date()) {
  if (session.playbackState !== "playing") {
    return Math.max(0, session.positionMs);
  }
  const elapsed = Math.max(0, at.getTime() - session.positionUpdatedAt.getTime());
  return Math.max(0, session.positionMs + elapsed);
}

export async function findActiveListeningSession(roomId: string) {
  return db.query.listeningSessions.findFirst({
    where: and(eq(schema.listeningSessions.roomId, roomId), isNull(schema.listeningSessions.endedAt)),
    orderBy: [desc(schema.listeningSessions.createdAt)],
  });
}

export async function getRoomListeningSnapshot(roomId: string): Promise<ListeningSnapshot | null> {
  return buildListeningSnapshotForRoom(roomId);
}

export async function publishListeningSnapshot(sessionId: string) {
  const snapshot = await buildListeningSnapshot(sessionId);
  if (!snapshot) return null;
  listeningEventBus.publish(sessionId, snapshot);
  return snapshot;
}

async function requireYouTubeLink(userId: string) {
  const link = await db.query.youtubeAccountLinks.findFirst({
    where: and(eq(schema.youtubeAccountLinks.userId, userId), isNull(schema.youtubeAccountLinks.revokedAt)),
  });
  if (!link) {
    throw codedError("youtube_link_required");
  }
  return link;
}

export async function startListeningSession(input: { roomId: string; userId: string; livekitRoomName: string }) {
  await requireYouTubeLink(input.userId);

  const existing = await findActiveListeningSession(input.roomId);
  if (existing) {
    throw codedError("active_listening_exists");
  }

  const now = new Date();
  const botIdentity = `listening-bot:${input.roomId}`;
  const [session] = await db
    .insert(schema.listeningSessions)
    .values({
      roomId: input.roomId,
      linkerUserId: input.userId,
      djUserId: input.userId,
      playbackState: "idle",
      currentQueueItemId: null,
      positionMs: 0,
      positionUpdatedAt: now,
      playbackGeneration: 0,
      errorMessage: null,
      botIdentity,
      createdAt: now,
    })
    .returning();

  // Connect the LiveKit bot immediately so the first play skips RTC join latency.
  void listeningWorkerBridge.prepare({
    sessionId: session.id,
    roomId: input.roomId,
    livekitRoomName: input.livekitRoomName,
    botIdentity,
  });

  const snapshot = await publishListeningSnapshot(session.id);
  return snapshot!;
}

export function canEndListeningSession(session: ListeningSession, room: { hostUserId: string }, userId: string) {
  return userId === room.hostUserId || userId === session.linkerUserId || userId === session.djUserId;
}

export function requireListeningDj(session: ListeningSession, room: { hostUserId: string }, userId: string) {
  if (userId !== room.hostUserId && userId !== session.djUserId) {
    throw codedError("not_listening_dj");
  }
}

export async function endListeningSession(input: { roomId: string; sessionId: string }) {
  await db
    .update(schema.listeningSessions)
    .set({ playbackState: "idle", endedAt: new Date(), errorMessage: null })
    .where(and(eq(schema.listeningSessions.id, input.sessionId), eq(schema.listeningSessions.roomId, input.roomId)));

  await listeningWorkerBridge.stop(input.sessionId, { teardown: true });

  const snapshot = await buildListeningSnapshot(input.sessionId);
  if (snapshot) {
    listeningEventBus.publish(input.sessionId, snapshot);
  }
  listeningEventBus.closeSession(input.sessionId);
  return snapshot;
}

export async function endListeningSessionsForLinker(userId: string) {
  const sessions = await db.query.listeningSessions.findMany({
    where: and(eq(schema.listeningSessions.linkerUserId, userId), isNull(schema.listeningSessions.endedAt)),
  });

  for (const session of sessions) {
    await endListeningSession({ roomId: session.roomId, sessionId: session.id });
  }
}

export async function endListeningSessionsForRoom(roomId: string) {
  const sessions = await db.query.listeningSessions.findMany({
    where: and(eq(schema.listeningSessions.roomId, roomId), isNull(schema.listeningSessions.endedAt)),
  });

  for (const session of sessions) {
    await endListeningSession({ roomId: session.roomId, sessionId: session.id });
  }
}

async function activeSessionOrThrow(roomId: string) {
  const session = await findActiveListeningSession(roomId);
  if (!session) {
    throw codedError("no_active_listening");
  }
  return session;
}

async function currentQueueCount(sessionId: string) {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.listeningQueueItems)
    .where(eq(schema.listeningQueueItems.sessionId, sessionId));
  return rows[0]?.count ?? 0;
}

function scheduleWarmForVideo(sessionId: string, videoId: string) {
  void listeningWorkerBridge.prefetch([videoId]);
  void listeningWorkerBridge.warm({ sessionId, videoId });
}

async function scheduleWarmNext(session: ListeningSession) {
  const next = await nextQueueItem(session);
  if (next) {
    scheduleWarmForVideo(session.id, next.videoId);
    return;
  }

  // Idle / nothing current: warm the first queued track so Play is snappy.
  if (!session.currentQueueItemId || session.playbackState === "idle") {
    const first = await firstQueueItem(session.id);
    if (first) {
      scheduleWarmForVideo(session.id, first.videoId);
    }
  }
}

export async function enqueueListeningItem(input: {
  roomId: string;
  addedByUserId: string;
  videoId: string;
  title?: string;
  channelTitle?: string | null;
  thumbnailUrl?: string | null;
  durationMs?: number | null;
  source: ListeningQueueSource;
  /** `next` inserts immediately after the current track (or at the front if idle). `last` appends. */
  placement?: "next" | "last";
}) {
  const session = await activeSessionOrThrow(input.roomId);
  const count = await currentQueueCount(session.id);
  if (count >= QUEUE_LIMIT) {
    throw codedError("queue_limit_reached");
  }

  const placement = input.placement ?? "last";
  const isActivelyPlaying = Boolean(session.currentQueueItemId) && session.playbackState !== "idle";
  const current = isActivelyPlaying && session.currentQueueItemId ? await queueItemById(session.id, session.currentQueueItemId) : null;

  await db.transaction(async (tx) => {
    let position: number;
    if (placement === "next") {
      position = current ? current.position + 1 : 0;
      // Shift high → low to avoid (session_id, position) unique collisions.
      const toShift = await tx.query.listeningQueueItems.findMany({
        where: and(eq(schema.listeningQueueItems.sessionId, session.id), gte(schema.listeningQueueItems.position, position)),
        orderBy: [desc(schema.listeningQueueItems.position)],
      });
      for (const item of toShift) {
        await tx
          .update(schema.listeningQueueItems)
          .set({ position: item.position + 1 })
          .where(eq(schema.listeningQueueItems.id, item.id));
      }
    } else {
      const [{ nextPosition }] = await tx
        .select({ nextPosition: sql<number>`coalesce(max(${schema.listeningQueueItems.position}), -1) + 1` })
        .from(schema.listeningQueueItems)
        .where(eq(schema.listeningQueueItems.sessionId, session.id));
      position = nextPosition;
    }

    await tx.insert(schema.listeningQueueItems).values({
      sessionId: session.id,
      position,
      videoId: input.videoId,
      title: input.title?.trim() || input.videoId,
      channelTitle: input.channelTitle ?? null,
      thumbnailUrl: input.thumbnailUrl ?? null,
      durationMs: input.durationMs ?? null,
      source: input.source,
      addedByUserId: input.addedByUserId,
      createdAt: new Date(),
    });
  });

  // Always resolve the URL into the worker cache; warm PCM when this is about to play next.
  void listeningWorkerBridge.prefetch([input.videoId]);
  if (placement === "next" || !isActivelyPlaying) {
    scheduleWarmForVideo(session.id, input.videoId);
  } else {
    const next = await nextQueueItem(session);
    if (!next || next.videoId === input.videoId) {
      scheduleWarmForVideo(session.id, input.videoId);
    }
  }

  return publishListeningSnapshot(session.id);
}

export async function setListeningDj(input: { room: RoomLike; sessionId: string; targetUserId: string }) {
  const openParticipants = await listOpenParticipants(input.room.id);
  const isMember = input.room.hostUserId === input.targetUserId || openParticipants.some((participant) => participant.userId === input.targetUserId);
  if (!isMember) {
    throw codedError("target_not_room_member");
  }

  await db
    .update(schema.listeningSessions)
    .set({ djUserId: input.targetUserId })
    .where(
      and(
        eq(schema.listeningSessions.id, input.sessionId),
        eq(schema.listeningSessions.roomId, input.room.id),
        isNull(schema.listeningSessions.endedAt)
      )
    );

  return publishListeningSnapshot(input.sessionId);
}

async function queueItemById(sessionId: string, itemId: string) {
  return db.query.listeningQueueItems.findFirst({
    where: and(eq(schema.listeningQueueItems.sessionId, sessionId), eq(schema.listeningQueueItems.id, itemId)),
  });
}

async function firstQueueItem(sessionId: string) {
  return db.query.listeningQueueItems.findFirst({
    where: eq(schema.listeningQueueItems.sessionId, sessionId),
    orderBy: [asc(schema.listeningQueueItems.position), asc(schema.listeningQueueItems.createdAt)],
  });
}

async function nextQueueItem(session: ListeningSession) {
  const current = session.currentQueueItemId ? await queueItemById(session.id, session.currentQueueItemId) : null;
  if (!current) return firstQueueItem(session.id);

  return db.query.listeningQueueItems.findFirst({
    where: and(eq(schema.listeningQueueItems.sessionId, session.id), gt(schema.listeningQueueItems.position, current.position)),
    orderBy: [asc(schema.listeningQueueItems.position), asc(schema.listeningQueueItems.createdAt)],
  });
}

async function previousQueueItem(session: ListeningSession) {
  const current = session.currentQueueItemId ? await queueItemById(session.id, session.currentQueueItemId) : null;
  if (!current) return firstQueueItem(session.id);

  return (
    (await db.query.listeningQueueItems.findFirst({
      where: and(eq(schema.listeningQueueItems.sessionId, session.id), lt(schema.listeningQueueItems.position, current.position)),
      orderBy: [desc(schema.listeningQueueItems.position), desc(schema.listeningQueueItems.createdAt)],
    })) ?? current
  );
}

async function setIdle(session: ListeningSession) {
  const now = new Date();
  await db
    .update(schema.listeningSessions)
    .set({
      playbackState: "idle",
      currentQueueItemId: null,
      positionMs: 0,
      positionUpdatedAt: now,
      playbackGeneration: session.playbackGeneration + 1,
      errorMessage: null,
    })
    .where(eq(schema.listeningSessions.id, session.id));
  await listeningWorkerBridge.stop(session.id);
  return publishListeningSnapshot(session.id);
}

async function playQueueItem(room: RoomLike, session: ListeningSession, item: typeof schema.listeningQueueItems.$inferSelect, positionMs = 0) {
  const now = new Date();
  const generation = session.playbackGeneration + 1;
  const safePosition = Math.max(0, positionMs);

  await db
    .update(schema.listeningSessions)
    .set({
      playbackState: "loading",
      currentQueueItemId: item.id,
      positionMs: safePosition,
      positionUpdatedAt: now,
      playbackGeneration: generation,
      errorMessage: null,
    })
    .where(and(eq(schema.listeningSessions.id, session.id), isNull(schema.listeningSessions.endedAt)));

  await listeningWorkerBridge.play({
    sessionId: session.id,
    roomId: room.id,
    livekitRoomName: room.livekitRoomName,
    videoId: item.videoId,
    positionMs: safePosition,
    generation,
    botIdentity: session.botIdentity,
  });

  // Warm the following track while this one loads/plays.
  void scheduleWarmNext({ ...session, currentQueueItemId: item.id, playbackState: "loading" });

  return publishListeningSnapshot(session.id);
}

export async function playListening(room: RoomLike) {
  const session = await activeSessionOrThrow(room.id);
  const current = session.currentQueueItemId ? await queueItemById(session.id, session.currentQueueItemId) : null;

  if (current && (session.playbackState === "paused" || session.playbackState === "loading")) {
    const now = new Date();
    const generation = session.playbackGeneration + 1;
    await db
      .update(schema.listeningSessions)
      .set({
        playbackState: "loading",
        positionUpdatedAt: now,
        playbackGeneration: generation,
        errorMessage: null,
      })
      .where(eq(schema.listeningSessions.id, session.id));
    await listeningWorkerBridge.resume(session.id, generation);
    return publishListeningSnapshot(session.id);
  }

  const item = current ?? (await firstQueueItem(session.id));
  if (!item) return setIdle(session);
  return playQueueItem(room, session, item, session.currentQueueItemId === item.id ? session.positionMs : 0);
}

export async function playListeningQueueItem(room: RoomLike, itemId: string) {
  const session = await activeSessionOrThrow(room.id);
  const item = await queueItemById(session.id, itemId);
  if (!item) {
    throw codedError("queue_item_not_found");
  }
  return playQueueItem(room, session, item, 0);
}

export async function pauseListening(roomId: string) {
  const session = await activeSessionOrThrow(roomId);
  const now = new Date();
  const positionMs = estimatedPositionMs(session, now);
  const generation = session.playbackGeneration + 1;

  // Surface loading immediately so every client can show a spinner while the worker acks.
  // Bump generation so a late playback_started from the prior play cannot clear this.
  await db
    .update(schema.listeningSessions)
    .set({
      playbackState: "loading",
      positionMs,
      positionUpdatedAt: now,
      playbackGeneration: generation,
      errorMessage: null,
    })
    .where(eq(schema.listeningSessions.id, session.id));
  void publishListeningSnapshot(session.id);

  await listeningWorkerBridge.pause(session.id, generation);

  await db
    .update(schema.listeningSessions)
    .set({
      playbackState: "paused",
      positionMs,
      positionUpdatedAt: new Date(),
      errorMessage: null,
    })
    .where(eq(schema.listeningSessions.id, session.id));

  return publishListeningSnapshot(session.id);
}

export async function seekListening(roomId: string, positionMs: number) {
  const session = await activeSessionOrThrow(roomId);
  const now = new Date();
  const generation = session.playbackGeneration + 1;
  const safePosition = Math.max(0, positionMs);
  const current = session.currentQueueItemId ? await queueItemById(session.id, session.currentQueueItemId) : null;

  await db
    .update(schema.listeningSessions)
    .set({
      playbackState: current ? "loading" : "idle",
      positionMs: safePosition,
      positionUpdatedAt: now,
      playbackGeneration: generation,
      errorMessage: null,
    })
    .where(eq(schema.listeningSessions.id, session.id));

  if (current) {
    const room = await db.query.rooms.findFirst({ where: eq(schema.rooms.id, roomId) });
    if (room) {
      // Prefer full play job so generation/video context stays consistent for cold workers.
      await listeningWorkerBridge.play({
        sessionId: session.id,
        roomId: room.id,
        livekitRoomName: room.livekitRoomName,
        videoId: current.videoId,
        positionMs: safePosition,
        generation,
        botIdentity: session.botIdentity,
      });
    } else {
      await listeningWorkerBridge.seek(session.id, safePosition, generation);
    }
  }

  return publishListeningSnapshot(session.id);
}

export async function skipListening(room: RoomLike) {
  const session = await activeSessionOrThrow(room.id);
  const item = await nextQueueItem(session);
  if (!item) return setIdle(session);
  return playQueueItem(room, session, item, 0);
}

export async function previousListening(room: RoomLike) {
  const session = await activeSessionOrThrow(room.id);
  const item = await previousQueueItem(session);
  if (!item) return setIdle(session);
  return playQueueItem(room, session, item, 0);
}

export async function removeListeningQueueItem(roomId: string, itemId: string) {
  const session = await activeSessionOrThrow(roomId);
  const item = await queueItemById(session.id, itemId);
  if (!item) {
    throw codedError("queue_item_not_found");
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.delete(schema.listeningQueueItems).where(eq(schema.listeningQueueItems.id, itemId));
    const remaining = await tx.query.listeningQueueItems.findMany({
      where: eq(schema.listeningQueueItems.sessionId, session.id),
      orderBy: [asc(schema.listeningQueueItems.position), asc(schema.listeningQueueItems.createdAt)],
    });
    for (let index = 0; index < remaining.length; index++) {
      await tx.update(schema.listeningQueueItems).set({ position: index }).where(eq(schema.listeningQueueItems.id, remaining[index].id));
    }
    if (session.currentQueueItemId === itemId) {
      await tx
        .update(schema.listeningSessions)
        .set({
          currentQueueItemId: null,
          playbackState: "idle",
          positionMs: 0,
          positionUpdatedAt: now,
          errorMessage: null,
        })
        .where(eq(schema.listeningSessions.id, session.id));
    }
  });

  if (session.currentQueueItemId === itemId) {
    await listeningWorkerBridge.stop(session.id);
  }

  return publishListeningSnapshot(session.id);
}

export async function reorderListeningQueue(roomId: string, orderedIds: string[]) {
  const session = await activeSessionOrThrow(roomId);
  const items = await db.query.listeningQueueItems.findMany({
    where: eq(schema.listeningQueueItems.sessionId, session.id),
    orderBy: [asc(schema.listeningQueueItems.position), asc(schema.listeningQueueItems.createdAt)],
  });
  const itemById = new Map(items.map((item) => [item.id, item]));
  const ordered = [
    ...orderedIds.map((id) => itemById.get(id)).filter((item): item is typeof schema.listeningQueueItems.$inferSelect => Boolean(item)),
    ...items.filter((item) => !orderedIds.includes(item.id)),
  ];

  await db.transaction(async (tx) => {
    for (let index = 0; index < ordered.length; index++) {
      await tx
        .update(schema.listeningQueueItems)
        .set({ position: index + 1000 })
        .where(eq(schema.listeningQueueItems.id, ordered[index].id));
    }
    for (let index = 0; index < ordered.length; index++) {
      await tx.update(schema.listeningQueueItems).set({ position: index }).where(eq(schema.listeningQueueItems.id, ordered[index].id));
    }
  });

  return publishListeningSnapshot(session.id);
}

export async function updateListeningPlaybackFields(
  roomId: string,
  values: Partial<
    Pick<ListeningSession, "playbackState" | "currentQueueItemId" | "positionMs" | "positionUpdatedAt" | "playbackGeneration" | "errorMessage">
  >
) {
  const session = await activeSessionOrThrow(roomId);
  await db.update(schema.listeningSessions).set(values).where(eq(schema.listeningSessions.id, session.id));
  return publishListeningSnapshot(session.id);
}

export type ListeningWorkerEventInput = {
  sessionId: string;
  event: "track_ended" | "track_error" | "playback_started" | "paused" | "resumed" | "position";
  generation?: number | null;
  positionMs?: number | null;
  at?: string | null;
  errorMessage?: string | null;
};

export async function handleListeningWorkerEvent(input: ListeningWorkerEventInput) {
  const session = await db.query.listeningSessions.findFirst({
    where: and(eq(schema.listeningSessions.id, input.sessionId), isNull(schema.listeningSessions.endedAt)),
  });
  if (!session) return null;

  const room = await db.query.rooms.findFirst({
    where: eq(schema.rooms.id, session.roomId),
  });
  if (!room) return null;

  const eventGeneration = input.generation;
  // Ignore only strictly stale events from an older play generation.
  if (typeof eventGeneration === "number" && eventGeneration < session.playbackGeneration) {
    return null;
  }

  const at = input.at ? new Date(input.at) : new Date();
  const positionMs = typeof input.positionMs === "number" ? Math.max(0, Math.round(input.positionMs)) : session.positionMs;

  if (input.event === "track_ended") {
    return skipListening(room);
  }

  // For non-end events, require an exact generation match when provided.
  if (typeof eventGeneration === "number" && eventGeneration !== session.playbackGeneration) {
    return null;
  }

  if (input.event === "playback_started" || input.event === "resumed") {
    // Ignore late start acks after the DJ already paused this generation.
    if (session.playbackState === "paused") {
      return null;
    }
    await db
      .update(schema.listeningSessions)
      .set({
        playbackState: "playing",
        positionMs,
        positionUpdatedAt: at,
        errorMessage: null,
      })
      .where(eq(schema.listeningSessions.id, session.id));

    if (input.event === "playback_started") {
      void scheduleWarmNext({ ...session, playbackState: "playing" });
    }

    return publishListeningSnapshot(session.id);
  }

  if (input.event === "paused") {
    await db
      .update(schema.listeningSessions)
      .set({
        playbackState: "paused",
        positionMs,
        positionUpdatedAt: at,
        errorMessage: null,
      })
      .where(eq(schema.listeningSessions.id, session.id));
    return publishListeningSnapshot(session.id);
  }

  if (input.event === "position") {
    if (session.playbackState !== "playing" && session.playbackState !== "loading") {
      return null;
    }
    await db
      .update(schema.listeningSessions)
      .set({
        playbackState: "playing",
        positionMs,
        positionUpdatedAt: at,
      })
      .where(eq(schema.listeningSessions.id, session.id));
    return publishListeningSnapshot(session.id);
  }

  await db
    .update(schema.listeningSessions)
    .set({
      playbackState: "error",
      positionMs,
      positionUpdatedAt: at,
      errorMessage: input.errorMessage ?? "Track failed",
    })
    .where(eq(schema.listeningSessions.id, session.id));
  const snapshot = await publishListeningSnapshot(session.id);

  setTimeout(() => {
    void skipListening(room);
  }, AUTO_SKIP_DELAY_MS);

  return snapshot;
}
