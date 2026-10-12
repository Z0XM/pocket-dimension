import { db, schema } from "@pocket-dimension/db";
import { eq } from "drizzle-orm";
import { summarizeIngestItems } from "$lib/server/ingest/errors";
import { DURATION_CAP_MESSAGE, isOverDurationCap } from "$lib/server/ingest/limits";
import { ingestCatalogueVideo, type IngestItemResult, type SyncRunResult } from "$lib/server/ingest/pipeline";
import { listYouTubePlaylistItems } from "./api";

/**
 * Import one or more connected playlists into the Zap catalogue via the Phase 3 ingest path.
 * Uses Data API for expansion (private/Liked), then yt-dlp+R2 per video id.
 */
export async function importConnectedPlaylists(userId: string, playlistIds: string[]): Promise<SyncRunResult & { playlists: string[] }> {
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

  try {
    for (const playlistId of uniqueIds) {
      const entries = await listYouTubePlaylistItems(userId, playlistId);
      for (const entry of entries) {
        if (isOverDurationCap(entry.durationMs)) {
          items.push({
            status: "skipped",
            reason: DURATION_CAP_MESSAGE,
            identityKey: `youtube:${entry.videoId}`,
            title: entry.title,
          });
          continue;
        }

        items.push(
          await ingestCatalogueVideo({
            userId,
            url: entry.url,
            identityKey: `youtube:${entry.videoId}`,
            titleHint: entry.title,
          })
        );
      }
    }

    const summary = summarizeIngestItems(items);

    await db
      .update(schema.syncRuns)
      .set({
        status: "completed",
        importedCount: summary.imported,
        skippedCount: summary.skipped,
        failedCount: summary.failed,
        errorMessage: summary.errorMessage,
        summaryJson: JSON.stringify({ playlists: uniqueIds, items, failures: summary.failures }),
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
        summaryJson: JSON.stringify({ playlists: uniqueIds, items, failures: summary.failures }),
        finishedAt: new Date(),
      })
      .where(eq(schema.syncRuns.id, run.id));
    throw err;
  }
}
