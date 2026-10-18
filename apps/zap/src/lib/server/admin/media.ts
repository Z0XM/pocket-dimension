import { db, schema } from "@pocket-dimension/db";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { publishSessionSnapshots } from "$lib/server/sessions/sessions";
import { deleteMediaObject } from "$lib/server/storage";
import { nextPlaybackAfterRemoval, planPositionCompaction } from "./media-removal";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type MediaDeleteResult = {
  id: string;
  title: string;
  storageKey: string | null;
  storageDeleted: boolean;
  storageError: string | null;
  removed: {
    tagLinks: number;
    queueItems: number;
    playlistItems: number;
    savedQueueItems: number;
    fetchJobs: number;
  };
  affectedLiveSessions: number;
};

async function compactQueueItems(tx: Tx, sessionId: string) {
  const rows = await tx
    .select({ id: schema.queueItems.id, position: schema.queueItems.position })
    .from(schema.queueItems)
    .where(eq(schema.queueItems.sessionId, sessionId))
    .orderBy(asc(schema.queueItems.position));
  for (const u of planPositionCompaction(rows)) {
    await tx.update(schema.queueItems).set({ position: u.position }).where(eq(schema.queueItems.id, u.id));
  }
  return rows;
}

async function compactPlaylistItems(tx: Tx, playlistId: string) {
  const rows = await tx
    .select({ id: schema.playlistItems.id, position: schema.playlistItems.position })
    .from(schema.playlistItems)
    .where(eq(schema.playlistItems.playlistId, playlistId));
  for (const u of planPositionCompaction(rows)) {
    await tx.update(schema.playlistItems).set({ position: u.position }).where(eq(schema.playlistItems.id, u.id));
  }
}

async function compactSavedQueueItems(tx: Tx, savedQueueId: string) {
  const rows = await tx
    .select({ id: schema.savedQueueItems.id, position: schema.savedQueueItems.position })
    .from(schema.savedQueueItems)
    .where(eq(schema.savedQueueItems.savedQueueId, savedQueueId));
  for (const u of planPositionCompaction(rows)) {
    await tx.update(schema.savedQueueItems).set({ position: u.position }).where(eq(schema.savedQueueItems.id, u.id));
  }
}

/**
 * Hard-delete a catalogue song: every DB reference, then its object in R2/S3.
 * The DB delete commits first — an orphaned object is harmless (same identity re-ingests to the same
 * key), whereas a row pointing at a deleted object would break playback.
 */
export async function deleteMediaAsset(mediaAssetId: string): Promise<MediaDeleteResult | null> {
  const asset = await db.query.mediaAssets.findFirst({ where: eq(schema.mediaAssets.id, mediaAssetId) });
  if (!asset) return null;

  const outcome = await db.transaction(async (tx) => {
    const tagLinks = await tx
      .delete(schema.mediaAssetTags)
      .where(eq(schema.mediaAssetTags.mediaAssetId, asset.id))
      .returning({ tagId: schema.mediaAssetTags.tagId });

    const removedQueue = await tx
      .delete(schema.queueItems)
      .where(eq(schema.queueItems.mediaAssetId, asset.id))
      .returning({ id: schema.queueItems.id, sessionId: schema.queueItems.sessionId, position: schema.queueItems.position });
    const removedQueueById = new Map(removedQueue.map((r) => [r.id, r]));
    const sessionIds = [...new Set(removedQueue.map((r) => r.sessionId))];
    const sessions = sessionIds.length > 0 ? await tx.select().from(schema.sessions).where(inArray(schema.sessions.id, sessionIds)) : [];

    const liveSessionIds: string[] = [];
    for (const session of sessions) {
      const remaining = await compactQueueItems(tx, session.id);
      if (session.status !== "live") continue;
      liveSessionIds.push(session.id);
      const removedCurrent = session.currentQueueItemId ? removedQueueById.get(session.currentQueueItemId) : undefined;
      if (!removedCurrent) continue;
      const patch = nextPlaybackAfterRemoval({
        removedCurrentPosition: removedCurrent.position,
        playbackState: session.playbackState,
        remaining,
      });
      await tx
        .update(schema.sessions)
        .set({ ...patch, positionUpdatedAt: new Date(), playbackGeneration: session.playbackGeneration + 1 })
        .where(eq(schema.sessions.id, session.id));
    }

    const playlistRows = await tx
      .delete(schema.playlistItems)
      .where(eq(schema.playlistItems.mediaAssetId, asset.id))
      .returning({ playlistId: schema.playlistItems.playlistId });
    for (const playlistId of new Set(playlistRows.map((r) => r.playlistId))) {
      await compactPlaylistItems(tx, playlistId);
    }

    const savedRows = await tx
      .delete(schema.savedQueueItems)
      .where(eq(schema.savedQueueItems.mediaAssetId, asset.id))
      .returning({ savedQueueId: schema.savedQueueItems.savedQueueId });
    for (const savedQueueId of new Set(savedRows.map((r) => r.savedQueueId))) {
      await compactSavedQueueItems(tx, savedQueueId);
    }

    // Drop the single-flight job too so the same source can be re-added later.
    const jobs = await tx
      .delete(schema.fetchJobs)
      .where(or(eq(schema.fetchJobs.identityKey, asset.identityKey), eq(schema.fetchJobs.mediaAssetId, asset.id)))
      .returning({ id: schema.fetchJobs.id });

    // Cascades: user_library_entries, play_events, playlist_exclusions.
    await tx.delete(schema.mediaAssets).where(eq(schema.mediaAssets.id, asset.id));

    return {
      removed: {
        tagLinks: tagLinks.length,
        queueItems: removedQueue.length,
        playlistItems: playlistRows.length,
        savedQueueItems: savedRows.length,
        fetchJobs: jobs.length,
      },
      liveSessionIds,
    };
  });

  try {
    await publishSessionSnapshots(outcome.liveSessionIds);
  } catch (err) {
    console.warn("[zap admin] snapshot publish after delete failed", err);
  }

  let storageDeleted = false;
  let storageError: string | null = null;
  if (asset.storageKey) {
    try {
      await deleteMediaObject(asset.storageKey);
      storageDeleted = true;
    } catch (err) {
      storageError = err instanceof Error ? err.message : String(err);
      console.error(`[zap admin] storage delete failed for ${asset.storageKey}`, err);
    }
  }

  return {
    id: asset.id,
    title: asset.title,
    storageKey: asset.storageKey,
    storageDeleted,
    storageError,
    removed: outcome.removed,
    affectedLiveSessions: outcome.liveSessionIds.length,
  };
}

export type AdminSongRow = {
  id: string;
  title: string;
  artists: string | null;
  status: string;
  sourceType: string;
  hasStorageObject: boolean;
  externalUrl: string | null;
  addedBy: string | null;
  createdAt: string;
};

export const ADMIN_SONG_STATUSES = ["pending", "ready", "failed", "unavailable"] as const;
export type AdminSongStatus = (typeof ADMIN_SONG_STATUSES)[number];

/** Every catalogue row (all statuses) for the admin songs table. */
export async function listSongsForAdmin(input: { q?: string; status?: AdminSongStatus | null; limit?: number; offset?: number }) {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const offset = Math.max(input.offset ?? 0, 0);
  const q = input.q?.trim() ?? "";
  const conditions = [];
  if (input.status) conditions.push(eq(schema.mediaAssets.status, input.status));
  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      or(ilike(schema.mediaAssets.title, pattern), ilike(schema.mediaAssets.artists, pattern), ilike(schema.mediaAssets.identityKey, pattern))!
    );
  }

  const rows = await db
    .select({
      asset: schema.mediaAssets,
      addedByEmail: schema.user.email,
      addedByUsername: schema.user.username,
    })
    .from(schema.mediaAssets)
    .leftJoin(schema.user, eq(schema.user.id, schema.mediaAssets.addedByUserId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(schema.mediaAssets.createdAt), desc(schema.mediaAssets.id))
    .limit(limit + 1)
    .offset(offset);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(schema.mediaAssets)
    .where(conditions.length ? and(...conditions) : undefined);

  const songs: AdminSongRow[] = page.map(({ asset, addedByEmail, addedByUsername }) => ({
    id: asset.id,
    title: asset.title,
    artists: asset.artists,
    status: asset.status,
    sourceType: asset.sourceType,
    hasStorageObject: Boolean(asset.storageKey),
    externalUrl: asset.externalUrl,
    addedBy: addedByUsername ?? addedByEmail ?? null,
    createdAt: asset.createdAt.toISOString(),
  }));
  return { songs, hasMore, nextOffset: offset + songs.length, total: total ?? 0 };
}
