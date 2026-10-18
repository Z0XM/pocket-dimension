import { db, schema } from "@pocket-dimension/db";
import { and, asc, desc, eq, gt, gte, inArray, sql } from "drizzle-orm";
import {
  MAX_CATALOG_QUEUE_ITEMS,
  PREVIOUS_RESTART_THRESHOLD_MS,
  dedupeIds,
  defaultOutputEnabled,
  estimatePositionMs,
  insertionIndex,
  isPermutation,
  neighbourId,
  type CatalogDevice,
  type CatalogPlaybackState,
  type CatalogQueueItem,
  type CatalogQueueRunSummary,
  type CatalogQueueSnapshot,
  type EnqueueMode,
} from "$lib/catalog-queue";
import { recordPlayEvent } from "$lib/server/play-history";
import { createPlaylist, type PlaylistSummary } from "$lib/server/playlists";
import { catalogQueueBus } from "./event-bus";

export class CatalogQueueError extends Error {
  constructor(
    message: string,
    readonly status: number = 400
  ) {
    super(message);
    this.name = "CatalogQueueError";
  }
}

type Db = typeof db;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Conn = Db | Tx;
type QueueRow = typeof schema.catalogQueues.$inferSelect;
type ItemRow = { id: string; mediaAssetId: string; position: number; source: string };

/** Devices not seen for this long drop out of the devices list. */
const DEVICE_LIST_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const HISTORY_TITLES = 4;

let seq = 0;

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

async function loadItems(conn: Conn, queueId: string): Promise<CatalogQueueItem[]> {
  const rows = await conn
    .select({
      id: schema.catalogQueueItems.id,
      mediaAssetId: schema.catalogQueueItems.mediaAssetId,
      position: schema.catalogQueueItems.position,
      source: schema.catalogQueueItems.source,
      title: schema.mediaAssets.title,
      artists: schema.mediaAssets.artists,
      durationMs: schema.mediaAssets.durationMs,
      status: schema.mediaAssets.status,
      storageKey: schema.mediaAssets.storageKey,
    })
    .from(schema.catalogQueueItems)
    .innerJoin(schema.mediaAssets, eq(schema.mediaAssets.id, schema.catalogQueueItems.mediaAssetId))
    .where(eq(schema.catalogQueueItems.queueId, queueId))
    .orderBy(asc(schema.catalogQueueItems.position), asc(schema.catalogQueueItems.createdAt));
  return rows.map((r) => ({
    id: r.id,
    mediaAssetId: r.mediaAssetId,
    position: r.position,
    source: r.source,
    title: r.title,
    artists: r.artists,
    durationMs: r.durationMs,
    playable: r.status === "ready" && Boolean(r.storageKey),
  }));
}

async function loadDevices(userId: string): Promise<CatalogDevice[]> {
  const since = new Date(Date.now() - DEVICE_LIST_WINDOW_MS);
  const rows = await db
    .select()
    .from(schema.catalogDevices)
    .where(and(eq(schema.catalogDevices.userId, userId), gt(schema.catalogDevices.lastSeenAt, since)))
    .orderBy(desc(schema.catalogDevices.lastSeenAt))
    .limit(20);
  const online = catalogQueueBus.onlineDeviceIds(userId);
  return rows
    .map((d) => ({
      deviceId: d.deviceId,
      label: d.label,
      outputEnabled: d.outputEnabled,
      volume: d.volume,
      online: online.has(d.deviceId),
      lastSeenAt: d.lastSeenAt.toISOString(),
    }))
    .sort((a, b) => Number(b.online) - Number(a.online));
}

async function getActiveQueue(conn: Conn, userId: string): Promise<QueueRow | null> {
  const row = await conn.query.catalogQueues.findFirst({
    where: and(eq(schema.catalogQueues.userId, userId), eq(schema.catalogQueues.status, "active")),
  });
  return row ?? null;
}

export async function buildCatalogQueueSnapshot(userId: string): Promise<CatalogQueueSnapshot> {
  const queue = await getActiveQueue(db, userId);
  const [items, devices] = await Promise.all([queue ? loadItems(db, queue.id) : Promise.resolve([]), loadDevices(userId)]);
  const currentItemId = queue?.currentItemId && items.some((i) => i.id === queue.currentItemId) ? queue.currentItemId : null;
  return {
    seq: ++seq,
    serverNow: new Date().toISOString(),
    queue: queue
      ? {
          id: queue.id,
          playbackState: currentItemId ? queue.playbackState : queue.playbackState === "playing" ? "idle" : queue.playbackState,
          currentItemId,
          positionMs: queue.positionMs,
          positionUpdatedAt: queue.positionUpdatedAt.toISOString(),
          playbackGeneration: queue.playbackGeneration,
          createdAt: queue.createdAt.toISOString(),
          updatedAt: queue.updatedAt.toISOString(),
        }
      : null,
    items,
    devices,
  };
}

export async function publishCatalogQueue(userId: string): Promise<CatalogQueueSnapshot> {
  const snapshot = await buildCatalogQueueSnapshot(userId);
  catalogQueueBus.publish(userId, snapshot);
  return snapshot;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

async function orderedItems(conn: Conn, queueId: string): Promise<ItemRow[]> {
  return conn
    .select({
      id: schema.catalogQueueItems.id,
      mediaAssetId: schema.catalogQueueItems.mediaAssetId,
      position: schema.catalogQueueItems.position,
      source: schema.catalogQueueItems.source,
    })
    .from(schema.catalogQueueItems)
    .where(eq(schema.catalogQueueItems.queueId, queueId))
    .orderBy(asc(schema.catalogQueueItems.position), asc(schema.catalogQueueItems.createdAt));
}

async function ensureActiveQueue(conn: Conn, userId: string): Promise<QueueRow> {
  const existing = await getActiveQueue(conn, userId);
  if (existing) return existing;
  await conn.insert(schema.catalogQueues).values({ userId, status: "active", playbackState: "idle" }).onConflictDoNothing();
  const created = await getActiveQueue(conn, userId);
  if (!created) throw new CatalogQueueError("Could not create queue", 500);
  return created;
}

async function setPlayback(
  conn: Conn,
  queueId: string,
  patch: Partial<{ playbackState: CatalogPlaybackState; positionMs: number; currentItemId: string | null }>
) {
  const now = new Date();
  await conn
    .update(schema.catalogQueues)
    .set({
      ...patch,
      positionUpdatedAt: now,
      playbackGeneration: sql`${schema.catalogQueues.playbackGeneration} + 1`,
      updatedAt: now,
    })
    .where(eq(schema.catalogQueues.id, queueId));
}

async function touchQueue(conn: Conn, queueId: string) {
  await conn.update(schema.catalogQueues).set({ updatedAt: new Date() }).where(eq(schema.catalogQueues.id, queueId));
}

async function currentDurationMs(conn: Conn, itemId: string | null): Promise<number | null> {
  if (!itemId) return null;
  const [row] = await conn
    .select({ durationMs: schema.mediaAssets.durationMs })
    .from(schema.catalogQueueItems)
    .innerJoin(schema.mediaAssets, eq(schema.mediaAssets.id, schema.catalogQueueItems.mediaAssetId))
    .where(eq(schema.catalogQueueItems.id, itemId));
  return row?.durationMs ?? null;
}

async function estimatedPosition(conn: Conn, queue: QueueRow): Promise<number> {
  return estimatePositionMs(queue, Date.now(), await currentDurationMs(conn, queue.currentItemId));
}

async function recordPlay(conn: Conn, userId: string, itemId: string | null) {
  if (!itemId) return;
  const item = await conn.query.catalogQueueItems.findFirst({ where: eq(schema.catalogQueueItems.id, itemId) });
  if (item) await recordPlayEvent({ userId, mediaAssetId: item.mediaAssetId });
}

/** Playable ids in input order (duplicates kept); unknown / unplayable ids are dropped. */
async function playableIds(ids: string[]): Promise<string[]> {
  const unique = dedupeIds(ids.filter((id) => typeof id === "string" && id.length > 0));
  if (unique.length === 0) return [];
  const rows = await db
    .select({ id: schema.mediaAssets.id })
    .from(schema.mediaAssets)
    .where(and(inArray(schema.mediaAssets.id, unique), eq(schema.mediaAssets.status, "ready")));
  const ok = new Set(rows.map((r) => r.id));
  return ids.filter((id) => ok.has(id));
}

/** Rewrite positions to 0..n-1 in `ids` order with one statement. */
async function writeOrder(conn: Conn, ids: string[]) {
  if (ids.length === 0) return;
  const values = sql.join(
    ids.map((id, idx) => sql`(${id}::uuid, ${idx}::int)`),
    sql`, `
  );
  await conn.execute(sql`UPDATE "zap"."catalog_queue_items" AS t SET "position" = v.pos FROM (VALUES ${values}) AS v(id, pos) WHERE t."id" = v.id`);
}

async function insertItems(conn: Conn, queueId: string, mediaAssetIds: string[], mode: EnqueueMode, currentItemId: string | null) {
  const rows = await orderedItems(conn, queueId);
  if (rows.length + mediaAssetIds.length > MAX_CATALOG_QUEUE_ITEMS) {
    throw new CatalogQueueError(`Queue is limited to ${MAX_CATALOG_QUEUE_ITEMS} tracks`);
  }
  const idx = insertionIndex(rows, currentItemId, mode);
  const startPos = idx < rows.length ? rows[idx]!.position : rows.length > 0 ? rows[rows.length - 1]!.position + 1 : 0;
  if (idx < rows.length) {
    await conn
      .update(schema.catalogQueueItems)
      .set({ position: sql`${schema.catalogQueueItems.position} + ${mediaAssetIds.length}` })
      .where(and(eq(schema.catalogQueueItems.queueId, queueId), gte(schema.catalogQueueItems.position, startPos)));
  }
  const source = mediaAssetIds.length > 1 && mode === "last" ? "bulk" : mode;
  return conn
    .insert(schema.catalogQueueItems)
    .values(mediaAssetIds.map((mediaAssetId, i) => ({ queueId, mediaAssetId, position: startPos + i, source })))
    .returning({ id: schema.catalogQueueItems.id });
}

async function endQueue(conn: Conn, queue: QueueRow) {
  const count = await conn.$count(schema.catalogQueueItems, eq(schema.catalogQueueItems.queueId, queue.id));
  if (count === 0) {
    await conn.delete(schema.catalogQueues).where(eq(schema.catalogQueues.id, queue.id));
    return;
  }
  const positionMs = await estimatedPosition(conn, queue);
  const now = new Date();
  await conn
    .update(schema.catalogQueues)
    .set({
      status: "ended",
      playbackState: queue.playbackState === "idle" ? "idle" : "paused",
      positionMs,
      positionUpdatedAt: now,
      endedAt: now,
      updatedAt: now,
    })
    .where(eq(schema.catalogQueues.id, queue.id));
}

async function requireActiveQueue(conn: Conn, userId: string): Promise<QueueRow> {
  const queue = await getActiveQueue(conn, userId);
  if (!queue) throw new CatalogQueueError("No active queue", 404);
  return queue;
}

// ---------------------------------------------------------------------------
// Queue edits
// ---------------------------------------------------------------------------

/**
 * Add tracks. `play` inserts after the playhead and starts the first one; other modes leave playback
 * alone, except that a queue with nothing loaded points its playhead at the first added track (paused).
 */
export async function enqueueTracks(userId: string, mediaAssetIds: string[], mode: EnqueueMode): Promise<CatalogQueueSnapshot> {
  const ids = await playableIds(mediaAssetIds);
  if (ids.length === 0) throw new CatalogQueueError("Nothing playable to add");

  let startedItemId: string | null = null;
  await db.transaction(async (tx) => {
    const queue = await ensureActiveQueue(tx, userId);
    const rows = await orderedItems(tx, queue.id);
    const currentItemId = queue.currentItemId && rows.some((r) => r.id === queue.currentItemId) ? queue.currentItemId : null;
    const inserted = await insertItems(tx, queue.id, ids, mode, currentItemId);
    const first = inserted[0]?.id ?? null;
    if (mode === "play" && first) {
      await setPlayback(tx, queue.id, { currentItemId: first, playbackState: "playing", positionMs: 0 });
      startedItemId = first;
    } else if (!currentItemId && first) {
      await setPlayback(tx, queue.id, { currentItemId: first, playbackState: "paused", positionMs: 0 });
    } else {
      await touchQueue(tx, queue.id);
    }
  });
  await recordPlay(db, userId, startedItemId);
  return publishCatalogQueue(userId);
}

/** Move the current queue to History and start a fresh one with these tracks. */
export async function replaceQueue(userId: string, mediaAssetIds: string[], opts: { play: boolean }): Promise<CatalogQueueSnapshot> {
  const ids = (await playableIds(mediaAssetIds)).slice(0, MAX_CATALOG_QUEUE_ITEMS);
  if (ids.length === 0) throw new CatalogQueueError("Nothing playable to add");

  let firstId: string | null = null;
  await db.transaction(async (tx) => {
    const existing = await getActiveQueue(tx, userId);
    if (existing) await endQueue(tx, existing);
    const queue = await ensureActiveQueue(tx, userId);
    const inserted = await insertItems(tx, queue.id, ids, "last", null);
    firstId = inserted[0]?.id ?? null;
    await setPlayback(tx, queue.id, { currentItemId: firstId, playbackState: opts.play ? "playing" : "paused", positionMs: 0 });
  });
  if (opts.play) await recordPlay(db, userId, firstId);
  return publishCatalogQueue(userId);
}

export async function removeItem(userId: string, itemId: string): Promise<CatalogQueueSnapshot> {
  await db.transaction(async (tx) => {
    const queue = await requireActiveQueue(tx, userId);
    const rows = await orderedItems(tx, queue.id);
    if (!rows.some((r) => r.id === itemId)) throw new CatalogQueueError("Track is not in the queue", 404);
    if (queue.currentItemId === itemId) {
      const next = neighbourId(rows, itemId, 1);
      await setPlayback(tx, queue.id, next ? { currentItemId: next, positionMs: 0 } : { currentItemId: null, playbackState: "idle", positionMs: 0 });
    } else {
      await touchQueue(tx, queue.id);
    }
    await tx.delete(schema.catalogQueueItems).where(eq(schema.catalogQueueItems.id, itemId));
  });
  return publishCatalogQueue(userId);
}

export async function reorderQueue(userId: string, order: string[]): Promise<CatalogQueueSnapshot> {
  await db.transaction(async (tx) => {
    const queue = await requireActiveQueue(tx, userId);
    const rows = await orderedItems(tx, queue.id);
    if (
      !isPermutation(
        rows.map((r) => r.id),
        order
      )
    ) {
      throw new CatalogQueueError("Queue changed — refresh and try again", 409);
    }
    await writeOrder(tx, order);
    await touchQueue(tx, queue.id);
  });
  return publishCatalogQueue(userId);
}

/** Stop: the run goes to History (playhead kept for Resume) and the floating player closes. */
export async function stopQueue(userId: string): Promise<CatalogQueueSnapshot> {
  await db.transaction(async (tx) => {
    const queue = await getActiveQueue(tx, userId);
    if (queue) await endQueue(tx, queue);
  });
  return publishCatalogQueue(userId);
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

export type TransportAction = "play" | "pause" | "seek" | "next" | "previous" | "jump" | "ended";

export async function transport(
  userId: string,
  action: TransportAction,
  opts: { positionMs?: number; itemId?: string; generation?: number } = {}
): Promise<CatalogQueueSnapshot> {
  let startedItemId: string | null = null;
  await db.transaction(async (tx) => {
    const queue = await requireActiveQueue(tx, userId);
    const rows = await orderedItems(tx, queue.id);
    const current = queue.currentItemId && rows.some((r) => r.id === queue.currentItemId) ? queue.currentItemId : null;
    const advance = async (from: string | null) => {
      const next = neighbourId(rows, from, 1);
      if (next) {
        await setPlayback(tx, queue.id, { currentItemId: next, positionMs: 0, playbackState: "playing" });
        startedItemId = next;
      } else {
        await setPlayback(tx, queue.id, { currentItemId: null, positionMs: 0, playbackState: "idle" });
      }
    };

    switch (action) {
      case "play": {
        if (rows.length === 0) throw new CatalogQueueError("Queue is empty");
        if (!current) {
          await setPlayback(tx, queue.id, { currentItemId: rows[0]!.id, positionMs: 0, playbackState: "playing" });
          startedItemId = rows[0]!.id;
        } else {
          const positionMs = await estimatedPosition(tx, queue);
          await setPlayback(tx, queue.id, { playbackState: "playing", positionMs });
          if (queue.playbackState === "idle") startedItemId = current;
        }
        return;
      }
      case "pause": {
        const positionMs = Number.isFinite(opts.positionMs) ? Math.max(0, Math.round(opts.positionMs!)) : await estimatedPosition(tx, queue);
        await setPlayback(tx, queue.id, { playbackState: current ? "paused" : "idle", positionMs });
        return;
      }
      case "seek": {
        if (!current) throw new CatalogQueueError("Nothing is loaded");
        const positionMs = Number(opts.positionMs);
        if (!Number.isFinite(positionMs)) throw new CatalogQueueError("positionMs required");
        await setPlayback(tx, queue.id, { positionMs: Math.max(0, Math.round(positionMs)) });
        return;
      }
      case "next":
        await advance(current);
        return;
      case "previous": {
        const pos = await estimatedPosition(tx, queue);
        const prev = neighbourId(rows, current, -1);
        if (!current || pos > PREVIOUS_RESTART_THRESHOLD_MS || !prev) {
          const target = current ?? rows[rows.length - 1]?.id ?? null;
          if (!target) throw new CatalogQueueError("Queue is empty");
          await setPlayback(tx, queue.id, { currentItemId: target, positionMs: 0 });
        } else {
          await setPlayback(tx, queue.id, { currentItemId: prev, positionMs: 0 });
          if (queue.playbackState === "playing") startedItemId = prev;
        }
        return;
      }
      case "jump": {
        if (!opts.itemId || !rows.some((r) => r.id === opts.itemId)) throw new CatalogQueueError("Track is not in the queue", 404);
        await setPlayback(tx, queue.id, { currentItemId: opts.itemId, positionMs: 0, playbackState: "playing" });
        startedItemId = opts.itemId;
        return;
      }
      case "ended": {
        // Every output device reports `ended`; only the first report for this track/generation advances.
        if (!current || opts.itemId !== current || opts.generation !== queue.playbackGeneration) return;
        await advance(current);
        return;
      }
    }
  });
  await recordPlay(db, userId, startedItemId);
  return publishCatalogQueue(userId);
}

/** Pause a playing queue at its estimated position (all devices went away). */
export async function pauseIfPlaying(userId: string): Promise<void> {
  const queue = await getActiveQueue(db, userId);
  if (!queue || queue.playbackState !== "playing") return;
  const positionMs = await estimatedPosition(db, queue);
  await setPlayback(db, queue.id, { playbackState: "paused", positionMs });
  await publishCatalogQueue(userId);
}

// ---------------------------------------------------------------------------
// History runs
// ---------------------------------------------------------------------------

export async function listQueueRuns(userId: string, limit = 30): Promise<CatalogQueueRunSummary[]> {
  const runs = await db.query.catalogQueues.findMany({
    where: eq(schema.catalogQueues.userId, userId),
    orderBy: [desc(schema.catalogQueues.updatedAt)],
    limit,
  });
  if (runs.length === 0) return [];
  const items = await db
    .select({
      id: schema.catalogQueueItems.id,
      queueId: schema.catalogQueueItems.queueId,
      title: schema.mediaAssets.title,
    })
    .from(schema.catalogQueueItems)
    .innerJoin(schema.mediaAssets, eq(schema.mediaAssets.id, schema.catalogQueueItems.mediaAssetId))
    .where(
      inArray(
        schema.catalogQueueItems.queueId,
        runs.map((r) => r.id)
      )
    )
    .orderBy(asc(schema.catalogQueueItems.position), asc(schema.catalogQueueItems.createdAt));
  const byQueue = new Map<string, { id: string; title: string }[]>();
  for (const item of items) {
    const list = byQueue.get(item.queueId) ?? [];
    list.push(item);
    byQueue.set(item.queueId, list);
  }
  return runs
    .map((run) => {
      const list = byQueue.get(run.id) ?? [];
      const idx = run.currentItemId ? list.findIndex((i) => i.id === run.currentItemId) : -1;
      return {
        id: run.id,
        status: run.status,
        trackCount: list.length,
        currentIndex: idx >= 0 ? idx : null,
        positionMs: idx >= 0 ? run.positionMs : 0,
        titles: list.slice(0, HISTORY_TITLES).map((i) => i.title),
        createdAt: run.createdAt.toISOString(),
        updatedAt: run.updatedAt.toISOString(),
        endedAt: run.endedAt?.toISOString() ?? null,
      };
    })
    .filter((run) => run.trackCount > 0);
}

async function requireOwnRun(conn: Conn, userId: string, runId: string): Promise<QueueRow> {
  const run = await conn.query.catalogQueues.findFirst({ where: eq(schema.catalogQueues.id, runId) });
  if (!run || run.userId !== userId) throw new CatalogQueueError("Queue not found", 404);
  return run;
}

/** Make a History run the active queue again: `restart` from track 1, `resume` at its saved playhead. */
export async function activateRun(userId: string, runId: string, mode: "restart" | "resume"): Promise<CatalogQueueSnapshot> {
  let startedItemId: string | null = null;
  await db.transaction(async (tx) => {
    const run = await requireOwnRun(tx, userId, runId);
    const rows = await orderedItems(tx, run.id);
    if (rows.length === 0) throw new CatalogQueueError("That queue is empty");
    const active = await getActiveQueue(tx, userId);
    if (active && active.id !== run.id) await endQueue(tx, active);
    if (run.status !== "active") {
      await tx.update(schema.catalogQueues).set({ status: "active", endedAt: null }).where(eq(schema.catalogQueues.id, run.id));
    }
    const resumeAt = mode === "resume" && run.currentItemId && rows.some((r) => r.id === run.currentItemId) ? run.currentItemId : null;
    const target = resumeAt ?? rows[0]!.id;
    await setPlayback(tx, run.id, { currentItemId: target, positionMs: resumeAt ? run.positionMs : 0, playbackState: "playing" });
    startedItemId = target;
  });
  await recordPlay(db, userId, startedItemId);
  return publishCatalogQueue(userId);
}

export async function deleteRun(userId: string, runId: string): Promise<CatalogQueueSnapshot> {
  const run = await requireOwnRun(db, userId, runId);
  await db.delete(schema.catalogQueues).where(eq(schema.catalogQueues.id, run.id));
  return publishCatalogQueue(userId);
}

export async function saveRunAsPlaylist(userId: string, runId: string, name: string): Promise<PlaylistSummary> {
  const run = await requireOwnRun(db, userId, runId);
  const rows = await orderedItems(db, run.id);
  if (rows.length === 0) throw new CatalogQueueError("That queue is empty");
  return createPlaylist({
    userId,
    name,
    description: "Saved from a catalogue queue",
    mediaAssetIds: rows.map((r) => r.mediaAssetId),
  });
}

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

/** Upsert the device row on connect; a brand-new device only gets audio when no other online device has it. */
export async function registerDevice(userId: string, deviceId: string, label: string): Promise<void> {
  const existing = await db.query.catalogDevices.findFirst({
    where: and(eq(schema.catalogDevices.userId, userId), eq(schema.catalogDevices.deviceId, deviceId)),
  });
  if (existing) {
    await db
      .update(schema.catalogDevices)
      .set({ lastSeenAt: new Date(), label: label || existing.label })
      .where(and(eq(schema.catalogDevices.userId, userId), eq(schema.catalogDevices.deviceId, deviceId)));
    return;
  }
  const online = [...catalogQueueBus.onlineDeviceIds(userId)].filter((id) => id !== deviceId);
  const others =
    online.length > 0
      ? await db
          .select({ outputEnabled: schema.catalogDevices.outputEnabled })
          .from(schema.catalogDevices)
          .where(and(eq(schema.catalogDevices.userId, userId), inArray(schema.catalogDevices.deviceId, online)))
      : [];
  await db
    .insert(schema.catalogDevices)
    .values({ userId, deviceId, label: label || "Browser", outputEnabled: defaultOutputEnabled(others) })
    .onConflictDoNothing();
}

export async function touchDevice(userId: string, deviceId: string): Promise<void> {
  await db
    .update(schema.catalogDevices)
    .set({ lastSeenAt: new Date() })
    .where(and(eq(schema.catalogDevices.userId, userId), eq(schema.catalogDevices.deviceId, deviceId)));
}

export async function updateDevice(
  userId: string,
  deviceId: string,
  patch: { outputEnabled?: boolean; volume?: number; label?: string }
): Promise<CatalogQueueSnapshot> {
  const set: Partial<typeof schema.catalogDevices.$inferInsert> = {};
  if (typeof patch.outputEnabled === "boolean") set.outputEnabled = patch.outputEnabled;
  if (typeof patch.volume === "number") set.volume = patch.volume;
  if (typeof patch.label === "string" && patch.label.trim()) set.label = patch.label.trim().slice(0, 60);
  if (Object.keys(set).length === 0) throw new CatalogQueueError("Nothing to update");
  const updated = await db
    .update(schema.catalogDevices)
    .set(set)
    .where(and(eq(schema.catalogDevices.userId, userId), eq(schema.catalogDevices.deviceId, deviceId)))
    .returning({ deviceId: schema.catalogDevices.deviceId });
  if (updated.length === 0) throw new CatalogQueueError("Device not found", 404);
  return publishCatalogQueue(userId);
}

export async function forgetDevice(userId: string, deviceId: string): Promise<CatalogQueueSnapshot> {
  if (catalogQueueBus.onlineDeviceIds(userId).has(deviceId)) throw new CatalogQueueError("Device is online — close Zap there first", 409);
  await db.delete(schema.catalogDevices).where(and(eq(schema.catalogDevices.userId, userId), eq(schema.catalogDevices.deviceId, deviceId)));
  return publishCatalogQueue(userId);
}
