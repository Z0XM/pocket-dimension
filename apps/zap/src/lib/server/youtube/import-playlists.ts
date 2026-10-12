import { db, schema } from "@pocket-dimension/db";
import { eq } from "drizzle-orm";
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

    const imported = items.filter((i) => i.status === "imported" || i.status === "reused").length;
    const skipped = items.filter((i) => i.status === "skipped").length;
    const failed = items.filter((i) => i.status === "failed").length;

    await db
      .update(schema.syncRuns)
      .set({
        status: "completed",
        importedCount: imported,
        skippedCount: skipped,
        failedCount: failed,
        summaryJson: JSON.stringify({ playlists: uniqueIds, items }),
        finishedAt: new Date(),
      })
      .where(eq(schema.syncRuns.id, run.id));

    return { syncRunId: run.id, imported, skipped, failed, items, playlists: uniqueIds };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Playlist import failed";
    await db
      .update(schema.syncRuns)
      .set({
        status: "failed",
        errorMessage: message,
        importedCount: items.filter((i) => i.status === "imported" || i.status === "reused").length,
        skippedCount: items.filter((i) => i.status === "skipped").length,
        failedCount: items.filter((i) => i.status === "failed").length,
        summaryJson: JSON.stringify({ playlists: uniqueIds, items }),
        finishedAt: new Date(),
      })
      .where(eq(schema.syncRuns.id, run.id));
    throw err;
  }
}
