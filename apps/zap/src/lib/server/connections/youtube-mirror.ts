import { db, schema } from "@pocket-dimension/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import { createPlaylist } from "$lib/server/playlists";
import { createImportJob, scheduleImportJob } from "$lib/server/import-jobs";
import { importConnectedPlaylists } from "$lib/server/youtube/import-playlists";
import { listYouTubePlaylistItems, listYouTubePlaylists, type ZapYouTubePlaylistItem } from "$lib/server/youtube/api";
import { isStorageConfigured } from "$lib/server/storage";
import { resolveYtDlpBin } from "$lib/server/ingest";
import { logConnectionActivity } from "./activity";
import { importStatusFromCounts, libraryYoutubeIdentityKeys, recordPlaylistImportCoverage, upsertPlaylistPref } from "./youtube-status";

export type YoutubeSyncMode = "additive" | "exact";
export type YoutubeSyncInterval = "off" | "hourly" | "every_6_hours" | "daily";

export const SYNC_INTERVAL_MS: Record<Exclude<YoutubeSyncInterval, "off">, number> = {
  hourly: 60 * 60 * 1000,
  every_6_hours: 6 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
};

export function parseSyncMode(v: unknown): YoutubeSyncMode | null {
  return v === "additive" || v === "exact" ? v : null;
}

export function parseSyncInterval(v: unknown): YoutubeSyncInterval | null {
  return v === "off" || v === "hourly" || v === "every_6_hours" || v === "daily" ? v : null;
}

export function syncIntervalToAutoSync(interval: YoutubeSyncInterval): boolean {
  return interval !== "off";
}

export type MirrorTrackChange = {
  videoId: string;
  title: string;
  mediaAssetId: string | null;
  needsDownload: boolean;
};

export type MirrorSyncPreview = {
  youtubePlaylistId: string;
  title: string;
  zapPlaylistId: string | null;
  syncMode: YoutubeSyncMode;
  syncInterval: YoutubeSyncInterval;
  connected: boolean;
  adds: MirrorTrackChange[];
  removes: MirrorTrackChange[];
  alreadyMatched: number;
  ytTotal: number;
  zapTotal: number;
  willDownload: number;
};

type AssetRow = { id: string; title: string; identityKey: string; status: string };

async function assetsByYoutubeIds(videoIds: string[]): Promise<Map<string, AssetRow>> {
  const unique = [...new Set(videoIds.filter(Boolean))];
  const out = new Map<string, AssetRow>();
  if (unique.length === 0) return out;

  for (let i = 0; i < unique.length; i += 200) {
    const chunk = unique.slice(i, i + 200);
    const keys = chunk.map((id) => `youtube:${id}`);
    const rows = await db
      .select({
        id: schema.mediaAssets.id,
        title: schema.mediaAssets.title,
        identityKey: schema.mediaAssets.identityKey,
        status: schema.mediaAssets.status,
      })
      .from(schema.mediaAssets)
      .where(inArray(schema.mediaAssets.identityKey, keys));
    for (const row of rows) {
      const videoId = row.identityKey.startsWith("youtube:") ? row.identityKey.slice("youtube:".length) : "";
      if (!videoId) continue;
      // Prefer ready over unavailable / other statuses when duplicates exist.
      const prev = out.get(videoId);
      if (!prev || (prev.status !== "ready" && row.status === "ready")) {
        out.set(videoId, row);
      }
    }
  }
  return out;
}

async function zapPlaylistTrackRows(
  playlistId: string
): Promise<Array<{ mediaAssetId: string; title: string; identityKey: string | null; videoId: string | null }>> {
  const items = await db.query.playlistItems.findMany({
    where: eq(schema.playlistItems.playlistId, playlistId),
    orderBy: [asc(schema.playlistItems.position)],
  });
  if (items.length === 0) return [];
  const assets = await db
    .select({
      id: schema.mediaAssets.id,
      title: schema.mediaAssets.title,
      identityKey: schema.mediaAssets.identityKey,
      status: schema.mediaAssets.status,
    })
    .from(schema.mediaAssets)
    .where(
      inArray(
        schema.mediaAssets.id,
        items.map((i) => i.mediaAssetId)
      )
    );
  const byId = new Map(assets.map((a) => [a.id, a]));
  return items
    .map((item) => {
      const asset = byId.get(item.mediaAssetId);
      if (!asset || asset.status === "archived") return null;
      const identityKey = asset.identityKey ?? null;
      const videoId = identityKey?.startsWith("youtube:") ? identityKey.slice("youtube:".length) : null;
      return {
        mediaAssetId: item.mediaAssetId,
        title: asset.title,
        identityKey,
        videoId,
      };
    })
    .filter((r): r is NonNullable<typeof r> => Boolean(r));
}

/** Replace Zap playlist items with `mediaAssetIds` in order (owner sync path). */
export async function replaceZapPlaylistTracks(playlistId: string, userId: string, mediaAssetIds: string[]) {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const id of mediaAssetIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }

  const ready =
    unique.length === 0
      ? []
      : await db
          .select({ id: schema.mediaAssets.id })
          .from(schema.mediaAssets)
          .where(and(eq(schema.mediaAssets.status, "ready"), inArray(schema.mediaAssets.id, unique)));
  const readySet = new Set(ready.map((r) => r.id));
  const ordered = unique.filter((id) => readySet.has(id));

  await db.delete(schema.playlistItems).where(eq(schema.playlistItems.playlistId, playlistId));
  if (ordered.length > 0) {
    await db.insert(schema.playlistItems).values(
      ordered.map((mediaAssetId, position) => ({
        playlistId,
        mediaAssetId,
        position,
        addedByUserId: userId,
      }))
    );
  }
  await db.update(schema.playlists).set({ updatedAt: new Date() }).where(eq(schema.playlists.id, playlistId));
}

async function appendMissingTracks(playlistId: string, userId: string, mediaAssetIds: string[]) {
  const existing = await db.query.playlistItems.findMany({
    where: eq(schema.playlistItems.playlistId, playlistId),
  });
  const have = new Set(existing.map((e) => e.mediaAssetId));
  const last = existing.reduce((max, row) => Math.max(max, row.position), -1);
  const toAdd = mediaAssetIds.filter((id) => id && !have.has(id));
  if (toAdd.length === 0) return 0;

  const ready = await db
    .select({ id: schema.mediaAssets.id })
    .from(schema.mediaAssets)
    .where(and(eq(schema.mediaAssets.status, "ready"), inArray(schema.mediaAssets.id, toAdd)));
  const readySet = new Set(ready.map((r) => r.id));
  const ordered = toAdd.filter((id) => readySet.has(id));
  if (ordered.length === 0) return 0;

  await db.insert(schema.playlistItems).values(
    ordered.map((mediaAssetId, i) => ({
      playlistId,
      mediaAssetId,
      position: last + 1 + i,
      addedByUserId: userId,
    }))
  );
  await db.update(schema.playlists).set({ updatedAt: new Date() }).where(eq(schema.playlists.id, playlistId));
  return ordered.length;
}

async function removeTracks(playlistId: string, mediaAssetIds: string[]) {
  if (mediaAssetIds.length === 0) return 0;
  await db
    .delete(schema.playlistItems)
    .where(and(eq(schema.playlistItems.playlistId, playlistId), inArray(schema.playlistItems.mediaAssetId, mediaAssetIds)));
  const remaining = await db.query.playlistItems.findMany({
    where: eq(schema.playlistItems.playlistId, playlistId),
    orderBy: [asc(schema.playlistItems.position)],
  });
  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i]!.position !== i) {
      await db.update(schema.playlistItems).set({ position: i }).where(eq(schema.playlistItems.id, remaining[i]!.id));
    }
  }
  return mediaAssetIds.length;
}

function dedupeYtItems(items: ZapYouTubePlaylistItem[]): ZapYouTubePlaylistItem[] {
  const seen = new Set<string>();
  const out: ZapYouTubePlaylistItem[] = [];
  for (const item of items) {
    if (!item.videoId || seen.has(item.videoId)) continue;
    seen.add(item.videoId);
    out.push(item);
  }
  return out;
}

export async function buildMirrorPreview(
  userId: string,
  youtubePlaylistId: string,
  opts?: { title?: string | null; items?: ZapYouTubePlaylistItem[] }
): Promise<MirrorSyncPreview> {
  const pref = await db.query.youtubePlaylistPrefs.findFirst({
    where: and(eq(schema.youtubePlaylistPrefs.userId, userId), eq(schema.youtubePlaylistPrefs.youtubePlaylistId, youtubePlaylistId)),
  });

  let title = opts?.title ?? pref?.title ?? youtubePlaylistId;
  const items = dedupeYtItems(opts?.items ?? (await listYouTubePlaylistItems(userId, youtubePlaylistId)));
  if (!opts?.title && !pref?.title) {
    const listed = await listYouTubePlaylists(userId).catch(() => []);
    title = listed.find((p) => p.id === youtubePlaylistId)?.title ?? title;
  }

  const zapPlaylistId = pref?.zapPlaylistId ?? null;
  const syncMode = (pref?.syncMode as YoutubeSyncMode | undefined) ?? "additive";
  const syncInterval = (pref?.syncInterval as YoutubeSyncInterval | undefined) ?? "off";

  const assets = await assetsByYoutubeIds(items.map((i) => i.videoId));
  const zapTracks = zapPlaylistId ? await zapPlaylistTrackRows(zapPlaylistId) : [];
  const zapByVideo = new Map(zapTracks.filter((t) => t.videoId).map((t) => [t.videoId!, t]));
  const zapAssetIds = new Set(zapTracks.map((t) => t.mediaAssetId));
  const ytVideoIds = new Set(items.map((i) => i.videoId));

  const adds: MirrorTrackChange[] = [];
  let alreadyMatched = 0;
  for (const item of items) {
    const asset = assets.get(item.videoId);
    const readyId = asset?.status === "ready" ? asset.id : null;
    const onZap = readyId ? zapAssetIds.has(readyId) : Boolean(zapByVideo.has(item.videoId));
    if (onZap) {
      alreadyMatched += 1;
      continue;
    }
    adds.push({
      videoId: item.videoId,
      title: item.title || asset?.title || item.videoId,
      mediaAssetId: readyId,
      needsDownload: !readyId,
    });
  }

  const removes: MirrorTrackChange[] = [];
  for (const track of zapTracks) {
    if (track.videoId && ytVideoIds.has(track.videoId)) continue;
    // Keep non-YouTube manual adds only in additive previews as "would remove in Exact".
    removes.push({
      videoId: track.videoId ?? "",
      title: track.title,
      mediaAssetId: track.mediaAssetId,
      needsDownload: false,
    });
  }

  // Refresh catalogue coverage cache (does not stamp lastSyncedAt).
  try {
    const inLibrary = await libraryYoutubeIdentityKeys(
      userId,
      items.map((i) => i.videoId)
    );
    await recordPlaylistImportCoverage({
      userId,
      youtubePlaylistId,
      title,
      total: items.length,
      alreadyImported: items.filter((i) => inLibrary.has(`youtube:${i.videoId}`)).length,
    });
  } catch (err) {
    console.warn("[zap youtube mirror preview coverage]", err);
  }

  return {
    youtubePlaylistId,
    title,
    zapPlaylistId,
    syncMode,
    syncInterval,
    connected: Boolean(zapPlaylistId),
    adds,
    removes,
    alreadyMatched,
    ytTotal: items.length,
    zapTotal: zapTracks.length,
    willDownload: adds.filter((a) => a.needsDownload).length,
  };
}

/**
 * Ensure a Zap playlist exists for this YouTube playlist (same title), link prefs, import missing
 * songs via a background job, then (best-effort) map already-ready tracks immediately.
 */
export async function connectYoutubePlaylist(
  userId: string,
  youtubePlaylistId: string,
  opts?: { title?: string | null; syncMode?: YoutubeSyncMode; syncInterval?: YoutubeSyncInterval }
): Promise<{
  youtubePlaylistId: string;
  title: string;
  zapPlaylistId: string;
  jobId: string | null;
  mappedNow: number;
}> {
  const listed = await listYouTubePlaylists(userId).catch(() => []);
  const ytMeta = listed.find((p) => p.id === youtubePlaylistId);
  const title = (opts?.title?.trim() || ytMeta?.title || "YouTube playlist").slice(0, 80);

  const existing = await db.query.youtubePlaylistPrefs.findFirst({
    where: and(eq(schema.youtubePlaylistPrefs.userId, userId), eq(schema.youtubePlaylistPrefs.youtubePlaylistId, youtubePlaylistId)),
  });

  let zapPlaylistId = existing?.zapPlaylistId ?? null;
  if (zapPlaylistId) {
    const stillThere = await db.query.playlists.findFirst({ where: eq(schema.playlists.id, zapPlaylistId) });
    if (!stillThere || stillThere.ownerUserId !== userId) zapPlaylistId = null;
  }

  if (!zapPlaylistId) {
    const created = await createPlaylist({ userId, name: title, visibility: "private" });
    zapPlaylistId = created.id;
  } else {
    // Keep Zap name aligned with YouTube when reconnecting.
    await db
      .update(schema.playlists)
      .set({ name: title, updatedAt: new Date() })
      .where(and(eq(schema.playlists.id, zapPlaylistId), eq(schema.playlists.ownerUserId, userId)));
  }

  const syncMode = opts?.syncMode ?? (existing?.syncMode as YoutubeSyncMode | undefined) ?? "additive";
  const syncInterval = opts?.syncInterval ?? (existing?.syncInterval as YoutubeSyncInterval | undefined) ?? "off";

  await upsertPlaylistPref({
    userId,
    youtubePlaylistId,
    title,
    zapPlaylistId,
    syncMode,
    syncInterval,
    autoSync: syncIntervalToAutoSync(syncInterval),
  });

  const items = dedupeYtItems(await listYouTubePlaylistItems(userId, youtubePlaylistId));
  const assets = await assetsByYoutubeIds(items.map((i) => i.videoId));
  const readyOrdered = items
    .map((item) => {
      const asset = assets.get(item.videoId);
      return asset?.status === "ready" ? asset.id : null;
    })
    .filter((id): id is string => Boolean(id));

  // First connect fills Exact-style so the Zap playlist matches what's already available.
  await replaceZapPlaylistTracks(zapPlaylistId, userId, readyOrdered);

  const missing = items.filter((item) => assets.get(item.videoId)?.status !== "ready");
  let jobId: string | null = null;
  if (missing.length > 0 && isStorageConfigured() && (await resolveYtDlpBin())) {
    const job = await createImportJob({
      userId,
      kind: "youtube_playlist",
      label: `Connect · ${title}`,
      source: {
        playlistIds: [youtubePlaylistId],
        sort: "playlist",
        skipExisting: true,
        mirrorZapPlaylistId: zapPlaylistId,
        mirrorSyncMode: "exact",
        title,
      },
    });
    scheduleImportJob(job.id);
    jobId = job.id;
  } else if (missing.length === 0) {
    await upsertPlaylistPref({
      userId,
      youtubePlaylistId,
      title,
      importStatus: importStatusFromCounts(items.length, items.length),
      alreadyImported: items.length,
      lastSyncedAt: new Date(),
      lastSyncError: null,
    });
  }

  await logConnectionActivity({
    userId,
    provider: "youtube",
    kind: "playlist_connected",
    summary: `Connected “${title}” → Zap playlist`,
    meta: { playlistId: youtubePlaylistId, zapPlaylistId, jobId, mappedNow: readyOrdered.length },
  });

  return { youtubePlaylistId, title, zapPlaylistId, jobId, mappedNow: readyOrdered.length };
}

/**
 * Apply a mirror sync for an already-connected playlist.
 * Downloads missing catalogue tracks when storage/yt-dlp are available, then updates Zap items.
 */
export async function applyMirrorSync(
  userId: string,
  youtubePlaylistId: string,
  opts?: { mode?: YoutubeSyncMode; asyncImport?: boolean }
): Promise<{
  added: number;
  removed: number;
  imported: number;
  jobId: string | null;
  zapPlaylistId: string;
  title: string;
  syncMode: YoutubeSyncMode;
}> {
  const pref = await db.query.youtubePlaylistPrefs.findFirst({
    where: and(eq(schema.youtubePlaylistPrefs.userId, userId), eq(schema.youtubePlaylistPrefs.youtubePlaylistId, youtubePlaylistId)),
  });
  if (!pref?.zapPlaylistId) {
    throw new Error("Connect this playlist first");
  }

  const zap = await db.query.playlists.findFirst({ where: eq(schema.playlists.id, pref.zapPlaylistId) });
  if (!zap || zap.ownerUserId !== userId) {
    throw new Error("Linked Zap playlist is missing — reconnect the playlist");
  }

  const syncMode = opts?.mode ?? (pref.syncMode as YoutubeSyncMode | undefined) ?? "additive";
  const title = pref.title ?? youtubePlaylistId;
  const items = dedupeYtItems(await listYouTubePlaylistItems(userId, youtubePlaylistId));
  let assets = await assetsByYoutubeIds(items.map((i) => i.videoId));
  const needsDownload = items.some((item) => assets.get(item.videoId)?.status !== "ready" && !item.unavailableReason);

  let imported = 0;
  let jobId: string | null = null;

  if (needsDownload) {
    if (opts?.asyncImport) {
      if (isStorageConfigured() && (await resolveYtDlpBin())) {
        const job = await createImportJob({
          userId,
          kind: "youtube_playlist",
          label: `Sync · ${title}`,
          source: {
            playlistIds: [youtubePlaylistId],
            sort: "playlist",
            skipExisting: true,
            mirrorZapPlaylistId: pref.zapPlaylistId,
            mirrorSyncMode: syncMode,
            title,
          },
        });
        scheduleImportJob(job.id);
        jobId = job.id;
      }
    } else if (isStorageConfigured() && (await resolveYtDlpBin())) {
      const result = await importConnectedPlaylists(userId, [youtubePlaylistId], undefined, {
        skipExisting: true,
        sort: "playlist",
      });
      imported = result.imported;
      assets = await assetsByYoutubeIds(items.map((i) => i.videoId));
    }
  }

  const desiredReadyIds = items
    .map((item) => {
      const asset = assets.get(item.videoId);
      return asset?.status === "ready" ? asset.id : null;
    })
    .filter((id): id is string => Boolean(id));

  let added = 0;
  let removed = 0;

  if (syncMode === "exact") {
    const before = await zapPlaylistTrackRows(pref.zapPlaylistId);
    const beforeSet = new Set(before.map((t) => t.mediaAssetId));
    const afterSet = new Set(desiredReadyIds);
    added = desiredReadyIds.filter((id) => !beforeSet.has(id)).length;
    removed = before.filter((t) => !afterSet.has(t.mediaAssetId)).length;
    await replaceZapPlaylistTracks(pref.zapPlaylistId, userId, desiredReadyIds);
  } else {
    added = await appendMissingTracks(pref.zapPlaylistId, userId, desiredReadyIds);
    removed = 0;
  }

  // If an async job will finish the rest, don't stamp a full success yet.
  if (!jobId) {
    const inLibrary = await libraryYoutubeIdentityKeys(
      userId,
      items.map((i) => i.videoId)
    );
    await upsertPlaylistPref({
      userId,
      youtubePlaylistId,
      title,
      importStatus: importStatusFromCounts(items.length, items.filter((i) => inLibrary.has(`youtube:${i.videoId}`)).length),
      alreadyImported: items.filter((i) => inLibrary.has(`youtube:${i.videoId}`)).length,
      lastSyncedAt: new Date(),
      lastSyncError: null,
    });
  }

  return {
    added,
    removed,
    imported,
    jobId,
    zapPlaylistId: pref.zapPlaylistId,
    title,
    syncMode,
  };
}

/** After a catalogue import job finishes, remap the linked Zap playlist. */
export async function finalizeMirrorAfterImport(
  userId: string,
  youtubePlaylistId: string,
  zapPlaylistId: string,
  syncMode: YoutubeSyncMode = "exact"
) {
  const zap = await db.query.playlists.findFirst({ where: eq(schema.playlists.id, zapPlaylistId) });
  if (!zap || zap.ownerUserId !== userId) return;

  const items = dedupeYtItems(await listYouTubePlaylistItems(userId, youtubePlaylistId));
  const assets = await assetsByYoutubeIds(items.map((i) => i.videoId));
  const desiredReadyIds = items
    .map((item) => {
      const asset = assets.get(item.videoId);
      return asset?.status === "ready" ? asset.id : null;
    })
    .filter((id): id is string => Boolean(id));

  if (syncMode === "exact") {
    await replaceZapPlaylistTracks(zapPlaylistId, userId, desiredReadyIds);
  } else {
    await appendMissingTracks(zapPlaylistId, userId, desiredReadyIds);
  }

  const inLibrary = await libraryYoutubeIdentityKeys(
    userId,
    items.map((i) => i.videoId)
  );
  const pref = await db.query.youtubePlaylistPrefs.findFirst({
    where: and(eq(schema.youtubePlaylistPrefs.userId, userId), eq(schema.youtubePlaylistPrefs.youtubePlaylistId, youtubePlaylistId)),
  });
  await upsertPlaylistPref({
    userId,
    youtubePlaylistId,
    title: pref?.title ?? null,
    zapPlaylistId,
    importStatus: importStatusFromCounts(items.length, items.filter((i) => inLibrary.has(`youtube:${i.videoId}`)).length),
    alreadyImported: items.filter((i) => inLibrary.has(`youtube:${i.videoId}`)).length,
    lastSyncedAt: new Date(),
    lastSyncError: null,
  });
}

export function intervalDue(lastSyncedAt: Date | null | undefined, interval: YoutubeSyncInterval, now = Date.now()): boolean {
  if (interval === "off") return false;
  if (!lastSyncedAt) return true;
  return now - lastSyncedAt.getTime() >= SYNC_INTERVAL_MS[interval];
}
