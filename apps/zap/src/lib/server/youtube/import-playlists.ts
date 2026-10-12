import { db, schema } from "@pocket-dimension/db";
import { eq } from "drizzle-orm";
import { summarizeIngestItems } from "$lib/server/ingest/errors";
import { DURATION_CAP_MESSAGE, isOverDurationCap } from "$lib/server/ingest/limits";
import { mapPool, youtubeIngestConcurrency } from "$lib/server/ingest/map-pool";
import { ingestCatalogueVideo, type IngestItemResult, type SyncRunResult } from "$lib/server/ingest/pipeline";
import type { SongProgress } from "$lib/server/ingest/progress";
import { listYouTubePlaylistItems, type ZapYouTubePlaylistItem } from "./api";

export type PlaylistImportProgress = {
  total: number;
  done: number;
  remaining: number;
  imported: number;
  skipped: number;
  failed: number;
  currentTitle?: string | null;
  /** In-flight / recent songs with download→upload percents (parallel workers). */
  songs?: SongProgress[];
};

type WorkItem = { kind: "skip"; entry: ZapYouTubePlaylistItem; reason: string } | { kind: "ingest"; entry: ZapYouTubePlaylistItem };

function tally(items: IngestItemResult[]) {
  const summary = summarizeIngestItems(items);
  return {
    imported: summary.imported,
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
  onProgress?: (progress: PlaylistImportProgress) => void | Promise<void>
): Promise<SyncRunResult & { playlists: string[] }> {
  const uniqueIds = [...new Set(playlistIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    throw new Error("Select at least one playlist");
  }

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
    };
    progressGate = progressGate
      .then(async () => {
        await onProgress?.(snapshot);
        await db
          .update(schema.syncRuns)
          .set({
            importedCount: snapshot.imported,
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

  try {
    const entryLists = await Promise.all(uniqueIds.map((playlistId) => listYouTubePlaylistItems(userId, playlistId)));

    const work: WorkItem[] = [];
    for (const entries of entryLists) {
      for (const entry of entries) {
        if (isOverDurationCap(entry.durationMs)) {
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
      skipped: 0,
      failed: 0,
      songs: [],
    });

    await mapPool(work, concurrency, async (job) => {
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
          onSongProgress: async (song) => {
            activeSongs.set(identityKey, song);
            await publish({ currentTitle: song.title ?? job.entry.title });
          },
        });
      }

      items.push(result);
      if (result.status === "failed") {
        activeSongs.set(identityKey, {
          identityKey,
          title: job.entry.title,
          phase: "failed",
          percent: 0,
        });
      } else if (result.status === "skipped") {
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
          phase: "done",
          percent: 100,
        });
      }
      await publish({ currentTitle: job.entry.title });
      // Drop finished songs from the active list shortly so the UI stays focused on in-flight work
      activeSongs.delete(identityKey);
      return result;
    });

    const summary = summarizeIngestItems(items);

    await db
      .update(schema.syncRuns)
      .set({
        status: "completed",
        importedCount: summary.imported,
        skippedCount: summary.skipped,
        failedCount: summary.failed,
        errorMessage: summary.errorMessage,
        summaryJson: JSON.stringify({ playlists: uniqueIds, items, failures: summary.failures, concurrency }),
        finishedAt: new Date(),
      })
      .where(eq(schema.syncRuns.id, run.id));

    return {
      syncRunId: run.id,
      imported: summary.imported,
      skipped: summary.skipped,
      failed: summary.failed,
      items,
      errorMessage: summary.errorMessage,
      failures: summary.failures,
      playlists: uniqueIds,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Playlist import failed";
    const summary = summarizeIngestItems(items);
    await db
      .update(schema.syncRuns)
      .set({
        status: "failed",
        errorMessage: message,
        importedCount: summary.imported,
        skippedCount: summary.skipped,
        failedCount: summary.failed,
        summaryJson: JSON.stringify({ playlists: uniqueIds, items, failures: summary.failures, concurrency }),
        finishedAt: new Date(),
      })
      .where(eq(schema.syncRuns.id, run.id));
    throw err;
  }
}
