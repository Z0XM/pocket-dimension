import { db, schema } from "@pocket-dimension/db";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { displayNameForUser } from "$lib/server/authz";
import { isListeningMediaReady, listListeningMediaReady } from "./media-ready";
import type { ListeningSnapshot, ListeningSnapshotQueueItem, ListeningSnapshotSession } from "./types";

export function emptyListeningSnapshot(): ListeningSnapshot {
  return {
    version: 0,
    serverNow: new Date().toISOString(),
    session: null,
    currentItem: null,
    queue: [],
    prefetchedVideoIds: [],
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

function serializeSession(session: typeof schema.listeningSessions.$inferSelect): ListeningSnapshotSession {
  return {
    id: session.id,
    roomId: session.roomId,
    linkerUserId: session.linkerUserId,
    djUserId: session.djUserId,
    playbackState: session.playbackState,
    currentQueueItemId: session.currentQueueItemId,
    positionMs: session.positionMs,
    positionUpdatedAt: session.positionUpdatedAt.toISOString(),
    playbackGeneration: session.playbackGeneration,
    errorMessage: session.errorMessage,
    botIdentity: session.botIdentity,
    createdAt: session.createdAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
  };
}

function serializeQueueItem(item: typeof schema.listeningQueueItems.$inferSelect, userNames: Map<string, string>): ListeningSnapshotQueueItem {
  return {
    id: item.id,
    sessionId: item.sessionId,
    position: item.position,
    videoId: item.videoId,
    title: item.title,
    channelTitle: item.channelTitle,
    thumbnailUrl: item.thumbnailUrl,
    durationMs: item.durationMs,
    source: item.source,
    addedByUserId: item.addedByUserId,
    addedByDisplayName: userNames.get(item.addedByUserId) ?? "Listener",
    createdAt: item.createdAt.toISOString(),
    prefetched: isListeningMediaReady(item.videoId),
  };
}

export async function buildListeningSnapshot(sessionId: string): Promise<ListeningSnapshot | null> {
  const session = await db.query.listeningSessions.findFirst({
    where: eq(schema.listeningSessions.id, sessionId),
  });

  if (!session) return null;

  const queueRows = await db.query.listeningQueueItems.findMany({
    where: eq(schema.listeningQueueItems.sessionId, sessionId),
    orderBy: [asc(schema.listeningQueueItems.position), asc(schema.listeningQueueItems.createdAt)],
  });
  const userNames = await loadUserNames(queueRows.map((item) => item.addedByUserId));
  const queue = queueRows.map((item) => serializeQueueItem(item, userNames));

  return {
    version: Date.now(),
    serverNow: new Date().toISOString(),
    session: serializeSession(session),
    currentItem: queue.find((item) => item.id === session.currentQueueItemId) ?? null,
    queue,
    prefetchedVideoIds: listListeningMediaReady(),
  };
}

export async function buildListeningSnapshotForRoom(roomId: string): Promise<ListeningSnapshot | null> {
  const session = await db.query.listeningSessions.findFirst({
    where: and(eq(schema.listeningSessions.roomId, roomId), isNull(schema.listeningSessions.endedAt)),
    orderBy: [desc(schema.listeningSessions.createdAt)],
  });

  if (!session) return null;
  return buildListeningSnapshot(session.id);
}
