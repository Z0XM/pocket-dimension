import { db, schema } from "@pocket-dimension/db";
import { eq } from "drizzle-orm";
import { addUserAssetTags, ensureCustomTags } from "$lib/server/catalogue";
import { summarizeIngestItems } from "$lib/server/ingest/errors";
import { DURATION_CAP_MESSAGE, isOverDurationCap } from "$lib/server/ingest/limits";
import { mapPool, youtubeIngestConcurrency } from "$lib/server/ingest/map-pool";
import { hasCatalogueAsset, ingestCatalogueVideo, type IngestItemResult, type SyncRunResult } from "$lib/server/ingest/pipeline";
import type { SongProgress } from "$lib/server/ingest/progress";
import { setUserLibraryOrder } from "$lib/server/library-order";
import { libraryYoutubeIdentityKeys, recordPlaylistImportCoverage } from "$lib/server/connections/youtube-status";
import { listYouTubePlaylistItems, listYouTubePlaylists, type ZapYouTubePlaylistItem } from "./api";
import { parsePlaylistImportSort, sortPlaylistItemsForImport, type PlaylistImportSort } from "$lib/youtube-playlist-sort";

export type PlaylistImportProgress = {
  total: number;
  done: number;
  remaining: number;
  imported: number;
  /** Saved as `unavailable` catalogue rows (metadata only). */
  unavailable: number;
  skipped: number;
  failed: number;
  currentTitle?: string | null;
  /** In-flight / recent songs with download→upload percents (parallel workers). */
  songs?: SongProgress[];
  /** `listing` = crawling YouTube playlist pages; `importing` = yt-dlp / R2 work. */
  phase?: "listing" | "importing";
};

type WorkItem = { kind: "skip"; entry: ZapYouTubePlaylistItem; reason: string } | { kind: "ingest"; entry: ZapYouTubePlaylistItem };

function tally(items: IngestItemResult[]) {
  const summary = summarizeIngestItems(items);
  return {
    imported: summary.imported,
    unavailable: summary.unavailable,
    skipped: summary.skipped,
    failed: summary.failed,
  };
}

/**
 * Import one or more connected playlists into the Zap catalogue via the Phase 3 ingest path.
 * Expands playlists in parallel, then ingests videos with bounded concurrency (yt-dlp + R2).
 */
export async function importConnectedPlaylists(
  userId: string,
  playlistIds: string[],
  onProgress?: (progress: PlaylistImportProgress) => void | Promise<void>,
  opts?: {
    tagIds?: string[];
    customTags?: string[];
    sort?: PlaylistImportSort | string;
    /** Skip videos already in the user's library (additive sync / re-import). */
    skipExisting?: boolean;
    /** Fired as each playlist entry finishes (skip / ingest), before ordered finalization. */
    onItemResult?: (result: IngestItemResult, position: number) => void | Promise<void>;
  }
): Promise<SyncRunResult & { playlists: string[] }> {
  const uniqueIds = [...new Set(playlistIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    throw new Error("Select at least one playlist");
  }

  const sort = parsePlaylistImportSort(opts?.sort);
  const tagIds = [...new Set((opts?.tagIds ?? []).map((id) => id.trim()).filter(Boolean))];
  for (const id of await ensureCustomTags(userId, opts?.customTags ?? [])) {
    if (!tagIds.includes(id)) tagIds.push(id);
  }
  const applyTags = tagIds.length > 0;

  const sourceUrl = `youtube:connected:${uniqueIds.join(",")}`;
  const [run] = await db
    .insert(schema.syncRuns)
    .values({
      userId,
      sourceUrl,
      status: "running",
    })
    .returning();

  if (!run) throw new Error("Failed to start sync run");

  const items: IngestItemResult[] = [];
  const concurrency = youtubeIngestConcurrency();
  /** Serialize progress/DB writes so concurrent workers don't clobber tallies. */
  let progressGate: Promise<void> = Promise.resolve();
  const activeSongs = new Map<string, SongProgress>();
  let playlistTitles: string[] = [];

  const publish = (extra?: { currentTitle?: string | null }) => {
    const counts = tally(items);
    const done = items.length;
    const snapshot: PlaylistImportProgress = {
      total: workTotal,
      done,
      remaining: Math.max(0, workTotal - done),
      ...counts,
      currentTitle: extra?.currentTitle,
      songs: [...activeSongs.values()],
      phase: "importing",
    };
    progressGate = progressGate
      .then(async () => {
        await onProgress?.(snapshot);
        await db
          .update(schema.syncRuns)
          .set({
            importedCount: snapshot.imported,
            unavailableCount: snapshot.unavailable,
            skippedCount: snapshot.skipped,
            failedCount: snapshot.failed,
          })
          .where(eq(schema.syncRuns.id, run.id));
      })
      .catch((err) => {
        console.warn("[zap youtube import progress]", err);
      });
    return progressGate;
  };

  let workTotal = 0;
  let listingLoaded = 0;

  try {
    // First byte immediately so reverse proxies don't idle-timeout during the playlist crawl.
    await onProgress?.({
      total: 0,
      done: 0,
      remaining: 0,
      imported: 0,
      unavailable: 0,
      skipped: 0,
      failed: 0,
      songs: [],
      phase: "listing",
      currentTitle: "Listing playlist…",
    });

    const knownPlaylistsPromise = listYouTubePlaylists(userId).catch(() => []);
    const entryLists: ZapYouTubePlaylistItem[][] = await Promise.all(
      uniqueIds.map((playlistId) =>
        listYouTubePlaylistItems(userId, playlistId, {
          onPage: async ({ pageSize }) => {
            listingLoaded += pageSize;
            await onProgress?.({
              total: 0,
              done: listingLoaded,
              remaining: 0,
              imported: 0,
              unavailable: 0,
              skipped: 0,
              failed: 0,
              songs: [],
              phase: "listing",
              currentTitle: `Listing… ${listingLoaded} tracks`,
            });
          },
        })
      )
    );
    const knownPlaylists = await knownPlaylistsPromise;
    const titleById = new Map(knownPlaylists.map((p) => [p.id, p.title]));
    playlistTitles = uniqueIds.map((id) => titleById.get(id) ?? id);

    // Sort each playlist independently, then concatenate in selection order.
    // Work list order = import order; mapPool preserves result slots despite parallel workers.
    const allVideoIds = entryLists.flatMap((entries) => entries.map((e) => e.videoId));
    const alreadyInLibrary = opts?.skipExisting ? await libraryYoutubeIdentityKeys(userId, allVideoIds) : new Set<string>();

    const work: WorkItem[] = [];
    const seenVideoIds = new Set<string>();
    for (const entries of entryLists) {
      const sorted = sortPlaylistItemsForImport(entries, sort);
      for (const entry of sorted) {
        if (seenVideoIds.has(entry.videoId)) continue;
        seenVideoIds.add(entry.videoId);
        if (opts?.skipExisting && alreadyInLibrary.has(`youtube:${entry.videoId}`)) {
          work.push({ kind: "skip", entry, reason: "Already in library" });
        } else if (isOverDurationCap(entry.durationMs)) {
          work.push({ kind: "skip", entry, reason: DURATION_CAP_MESSAGE });
        } else {
          work.push({ kind: "ingest", entry });
        }
      }
    }

    workTotal = work.length;
    await onProgress?.({
      total: workTotal,
      done: 0,
      remaining: workTotal,
      imported: 0,
      unavailable: 0,
      skipped: 0,
      failed: 0,
      songs: [],
      phase: "importing",
      currentTitle: workTotal === 0 ? "Nothing new to import" : "Starting import…",
    });
    const orderedResults = await mapPool(work, concurrency, async (job) => {
      const identityKey = `youtube:${job.entry.videoId}`;
      let result: IngestItemResult;
      if (job.kind === "skip") {
        result = {
          status: "skipped",
          reason: job.reason,
          identityKey,
          title: job.entry.title,
        };
        activeSongs.set(identityKey, {
          identityKey,
          title: job.entry.title,
          phase: "skipped",
          percent: 100,
        });
      } else {
        activeSongs.set(identityKey, {
          identityKey,
          title: job.entry.title,
          phase: "probing",
          percent: 0,
        });
        await publish({ currentTitle: job.entry.title });
        result = await ingestCatalogueVideo({
          userId,
          url: job.entry.url,
          identityKey,
          titleHint: job.entry.title,
          metaHints: {
            description: job.entry.description,
            channelTitle: job.entry.channelTitle,
            channelId: job.entry.channelId,
          },
          durationHint: job.entry.durationMs,
          recordUnavailable: true,
          unavailableReason: job.entry.unavailableReason,
          onSongProgress: async (song) => {
            activeSongs.set(identityKey, song);
            await publish({ currentTitle: song.title ?? job.entry.title });
          },
        });
      }

      // Live tallies may complete out of order; final `items` use mapPool order below.
      items.push(result);
      if (applyTags && hasCatalogueAsset(result)) {
        try {
          await addUserAssetTags(userId, result.mediaAssetId, tagIds);
        } catch (err) {
          console.warn("[zap youtube import tags]", result.mediaAssetId, err);
        }
      }
      if (result.status === "failed") {
        activeSongs.set(identityKey, {
          identityKey,
          title: job.entry.title,
          phase: "failed",
          percent: 0,
        });
      } else if (result.status === "skipped" || result.status === "unavailable") {
        activeSongs.set(identityKey, {
          identityKey,
          title: job.entry.title,
          phase: result.status,
          percent: 100,
        });
      } else {
        activeSongs.set(identityKey, {
          identityKey,
          title: job.entry.title,
          phase: "done",
          percent: 100,
        });
      }
      await publish({ currentTitle: job.entry.title });
      try {
        await opts?.onItemResult?.(result, items.length - 1);
      } catch (err) {
        console.warn("[zap youtube import onItemResult]", err);
      }
      // Drop finished songs from the active list shortly so the UI stays focused on in-flight work
      activeSongs.delete(identityKey);
      return result;
    });

    items.length = 0;
    items.push(...orderedResults);

    const orderedAssetIds = items.filter(hasCatalogueAsset).map((i) => i.mediaAssetId);
    try {
      await setUserLibraryOrder({ userId, mediaAssetIds: orderedAssetIds, syncRunId: run.id });
    } catch (err) {
      console.warn("[zap youtube import library order]", err);
    }

    const summary = summarizeIngestItems(items);
    const summaryPayload = {
      playlists: uniqueIds.map((id, i) => ({ id, title: playlistTitles[i] ?? id })),
      playlistTitles,
      sort,
      orderedIdentityKeys: items.map((i) => i.identityKey),
      orderedMediaAssetIds: orderedAssetIds,
      tagIds,
      items,
      failures: summary.failures,
      unavailable: summary.unavailableItems,
      concurrency,
    };

    await db
      .update(schema.syncRuns)
      .set({
        status: "completed",
        importedCount: summary.imported,
        unavailableCount: summary.unavailable,
        skippedCount: summary.skipped,
        failedCount: summary.failed,
        errorMessage: summary.errorMessage,
        summaryJson: JSON.stringify(summaryPayload),
        finishedAt: new Date(),
      })
      .where(eq(schema.syncRuns.id, run.id));

    // Persist per-playlist coverage so Connections stops showing stale "Not imported".
    try {
      const postImportKeys = await libraryYoutubeIdentityKeys(
        userId,
        entryLists.flatMap((entries) => entries.map((e) => e.videoId))
      );
      for (let i = 0; i < uniqueIds.length; i++) {
        const entries = entryLists[i] ?? [];
        const alreadyImported = entries.filter((e) => postImportKeys.has(`youtube:${e.videoId}`)).length;
        await recordPlaylistImportCoverage({
          userId,
          youtubePlaylistId: uniqueIds[i]!,
          title: playlistTitles[i] ?? null,
          total: entries.length,
          alreadyImported,
          synced: true,
          lastSyncError: null,
        });
      }
    } catch (err) {
      console.warn("[zap youtube import status prefs]", err);
    }

    // Drain queued progress writes before the NDJSON controller closes.
    await progressGate;

    return {
      syncRunId: run.id,
      imported: summary.imported,
      unavailable: summary.unavailable,
      skipped: summary.skipped,
      failed: summary.failed,
      items,
      errorMessage: summary.errorMessage,
      failures: summary.failures,
      playlists: uniqueIds,
    };
  } catch (err) {
    await progressGate.catch(() => {});
    const message = err instanceof Error ? err.message : "Playlist import failed";
    const summary = summarizeIngestItems(items);
    await db
      .update(schema.syncRuns)
      .set({
        status: "failed",
        errorMessage: message,
        importedCount: summary.imported,
        unavailableCount: summary.unavailable,
        skippedCount: summary.skipped,
        failedCount: summary.failed,
        summaryJson: JSON.stringify({
          playlists: uniqueIds.map((id, i) => ({ id, title: playlistTitles[i] ?? id })),
          playlistTitles,
          sort,
          orderedIdentityKeys: items.map((i) => i.identityKey),
          tagIds,
          items,
          failures: summary.failures,
          concurrency,
        }),
        finishedAt: new Date(),
      })
      .where(eq(schema.syncRuns.id, run.id));
    throw err;
  }
}
