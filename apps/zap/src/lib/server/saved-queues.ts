import { db, schema } from "@pocket-dimension/db";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { SessionError, enqueueCatalogueTrack, getSessionForUser } from "$lib/server/sessions";
import type { SessionSnapshot } from "$lib/server/sessions/types";

export type SavedQueueSummary = {
  id: string;
  name: string;
  createdAt: string;
  trackCount: number;
  titles: string[];
};

export async function saveQueueFromSession(opts: { userId: string; sessionId: string; name?: string }): Promise<SavedQueueSummary> {
  const snapshot = await getSessionForUser(opts.sessionId, opts.userId);
  if (snapshot.queue.length === 0) {
    throw new SessionError("Queue is empty — nothing to save", 400);
  }

  const name = (opts.name?.trim() || `Saved ${new Date().toLocaleString()}`).slice(0, 80);
  const [saved] = await db
    .insert(schema.savedQueues)
    .values({
      userId: opts.userId,
      name,
      sourceSessionId: opts.sessionId,
    })
    .returning();
  if (!saved) throw new SessionError("Failed to save queue", 500);

  await db.insert(schema.savedQueueItems).values(
    snapshot.queue.map((item, position) => ({
      savedQueueId: saved.id,
      mediaAssetId: item.mediaAssetId,
      position,
    }))
  );

  return {
    id: saved.id,
    name: saved.name,
    createdAt: saved.createdAt.toISOString(),
    trackCount: snapshot.queue.length,
    titles: snapshot.queue.slice(0, 5).map((q) => q.title),
  };
}

export async function listSavedQueues(userId: string, limit = 30): Promise<SavedQueueSummary[]> {
  const queues = await db.query.savedQueues.findMany({
    where: eq(schema.savedQueues.userId, userId),
    orderBy: [desc(schema.savedQueues.createdAt)],
    limit,
  });
  if (queues.length === 0) return [];

  const items = await db.query.savedQueueItems.findMany({
    where: inArray(
      schema.savedQueueItems.savedQueueId,
      queues.map((q) => q.id)
    ),
    orderBy: [asc(schema.savedQueueItems.position)],
  });

  const assetIds = [...new Set(items.map((i) => i.mediaAssetId))];
  const assets =
    assetIds.length > 0
      ? await db.query.mediaAssets.findMany({
          where: inArray(schema.mediaAssets.id, assetIds),
        })
      : [];
  const titleById = new Map(assets.map((a) => [a.id, a.title]));

  return queues.map((q) => {
    const qItems = items.filter((i) => i.savedQueueId === q.id);
    return {
      id: q.id,
      name: q.name,
      createdAt: q.createdAt.toISOString(),
      trackCount: qItems.length,
      titles: qItems.slice(0, 5).map((i) => titleById.get(i.mediaAssetId) ?? "Unknown"),
    };
  });
}

/** Enqueue all tracks from a saved queue into a live session (in saved order). */
export async function loadSavedQueueIntoSession(sessionId: string, userId: string, savedQueueId: string): Promise<SessionSnapshot> {
  const saved = await db.query.savedQueues.findFirst({
    where: and(eq(schema.savedQueues.id, savedQueueId), eq(schema.savedQueues.userId, userId)),
  });
  if (!saved) throw new SessionError("Saved queue not found", 404);

  const items = await db.query.savedQueueItems.findMany({
    where: eq(schema.savedQueueItems.savedQueueId, savedQueueId),
    orderBy: [asc(schema.savedQueueItems.position)],
  });
  if (items.length === 0) throw new SessionError("Saved queue is empty", 400);

  let snapshot: SessionSnapshot | null = null;
  for (const item of items) {
    snapshot = await enqueueCatalogueTrack(sessionId, userId, item.mediaAssetId);
  }
  if (!snapshot) throw new SessionError("Failed to load queue", 500);
  return snapshot;
}
