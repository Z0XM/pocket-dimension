import { ensureCustomTags } from "$lib/server/catalogue";
import { ingestCatalogueVideo, ingestPublicUrl, type IngestItemResult } from "$lib/server/ingest/pipeline";
import { importConnectedPlaylists } from "$lib/server/youtube/import-playlists";
import { clearJobLiveSongs, setJobLiveSongs } from "./live-progress";
import {
  completeJob,
  getImportJobItem,
  markItemStatus,
  markJobRunning,
  recordIngestResult,
  recountJobFailures,
  updateJobProgress,
} from "./store";

const runningLocal = new Set<string>();

function sourceUrlForIdentity(identityKey: string, fallback?: string | null): string | null {
  if (fallback) return fallback;
  if (identityKey.startsWith("youtube:")) {
    const id = identityKey.slice("youtube:".length);
    if (id) return `https://www.youtube.com/watch?v=${id}`;
  }
  return null;
}

async function persistResults(jobId: string, items: IngestItemResult[]) {
  let position = 0;
  for (const item of items) {
    const identityKey = item.identityKey ?? `unknown:${position}`;
    await recordIngestResult(jobId, item, {
      sourceUrl: sourceUrlForIdentity(identityKey),
      position: position++,
    });
  }
}

async function loadJobForWorker(jobId: string) {
  const { db, schema } = await import("@pocket-dimension/db");
  const { eq } = await import("drizzle-orm");
  const row = await db.query.importJobs.findFirst({ where: eq(schema.importJobs.id, jobId) });
  if (!row) return null;
  let source: Record<string, unknown> = {};
  try {
    source = row.sourceJson ? (JSON.parse(row.sourceJson) as Record<string, unknown>) : {};
  } catch {
    source = {};
  }
  return { row, source };
}

export async function runImportJob(jobId: string): Promise<void> {
  if (runningLocal.has(jobId)) return;
  runningLocal.add(jobId);
  try {
    const loaded = await loadJobForWorker(jobId);
    if (!loaded) return;
    const { row, source } = loaded;
    if (row.status === "completed") return;

    await markJobRunning(jobId);
    const userId = row.userId;
    const tagIds = Array.isArray(source.tagIds) ? (source.tagIds as string[]) : [];
    const customTags = Array.isArray(source.customTags) ? (source.customTags as string[]) : [];

    if (row.kind === "url") {
      const url = typeof source.url === "string" ? source.url : "";
      if (!url) throw new Error("Missing URL");
      const resolvedTagIds = [...tagIds, ...(await ensureCustomTags(userId, customTags))];
      const result = await ingestPublicUrl(
        userId,
        url,
        async (song) => {
          setJobLiveSongs(jobId, [song]);
          await updateJobProgress(jobId, { currentTitle: song.title ?? null });
        },
        { tagIds: resolvedTagIds }
      );
      await persistResults(jobId, result.items);
      clearJobLiveSongs(jobId);
      await completeJob(jobId, {
        status: result.failed > 0 && result.imported === 0 ? "failed" : "completed",
        syncRunId: result.syncRunId,
        errorMessage: result.errorMessage ?? null,
        importedCount: result.imported,
        skippedCount: result.skipped,
        failedCount: result.failed,
        unavailableCount: result.unavailable,
        total: result.items.length,
        done: result.items.length,
      });
      return;
    }

    if (row.kind === "youtube_playlist") {
      const playlistIds = Array.isArray(source.playlistIds) ? (source.playlistIds as string[]) : [];
      let itemPosition = 0;
      const result = await importConnectedPlaylists(
        userId,
        playlistIds,
        async (progress) => {
          setJobLiveSongs(jobId, progress.songs ?? []);
          await updateJobProgress(jobId, {
            total: progress.total,
            done: progress.done,
            importedCount: progress.imported,
            skippedCount: progress.skipped,
            failedCount: progress.failed,
            unavailableCount: progress.unavailable,
            currentTitle: progress.currentTitle ?? null,
          });
        },
        {
          tagIds,
          customTags,
          sort: typeof source.sort === "string" ? source.sort : "playlist",
          skipExisting: Boolean(source.skipExisting),
          onItemResult: async (item) => {
            const identityKey = item.identityKey ?? `unknown:${itemPosition}`;
            await recordIngestResult(jobId, item, {
              sourceUrl: sourceUrlForIdentity(identityKey),
              position: itemPosition++,
            });
          },
        }
      );
      // Ensure final set is persisted (idempotent upserts).
      await persistResults(jobId, result.items);
      clearJobLiveSongs(jobId);
      await completeJob(jobId, {
        status: "completed",
        syncRunId: result.syncRunId,
        errorMessage: result.errorMessage ?? null,
        importedCount: result.imported,
        skippedCount: result.skipped,
        failedCount: result.failed,
        unavailableCount: result.unavailable,
        total: result.items.length,
        done: result.items.length,
      });
      return;
    }

    if (row.kind === "upload" && (row.status === "queued" || row.status === "running")) {
      await completeJob(jobId, { status: "failed", errorMessage: "Upload job was not finished in-request" });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import job failed";
    console.error("[zap import-jobs] run failed", jobId, err);
    await completeJob(jobId, { status: "failed", errorMessage: message }).catch(() => {});
  } finally {
    clearJobLiveSongs(jobId);
    runningLocal.delete(jobId);
  }
}

/** Fire-and-forget so the HTTP request can return immediately. */
export function scheduleImportJob(jobId: string) {
  void runImportJob(jobId).catch((err) => console.error("[zap import-jobs] schedule", jobId, err));
}

export async function retryFailedImportItem(itemId: string, userId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const item = await getImportJobItem(itemId, userId);
  if (!item) return { ok: false, message: "Item not found" };
  if (item.status !== "failed") return { ok: false, message: "Only failed items can be retried" };

  const url = sourceUrlForIdentity(item.identityKey, item.sourceUrl);
  if (!url) return { ok: false, message: "No source URL to retry" };

  await markItemStatus(itemId, "running", { reason: null });
  try {
    const result = await ingestCatalogueVideo({
      userId,
      url,
      identityKey: item.identityKey,
      titleHint: item.title ?? undefined,
      recordUnavailable: item.identityKey.startsWith("youtube:"),
    });
    const status =
      result.status === "imported"
        ? ("imported" as const)
        : result.status === "reused"
          ? ("reused" as const)
          : result.status === "skipped"
            ? ("skipped" as const)
            : result.status === "unavailable"
              ? ("unavailable" as const)
              : ("failed" as const);
    await markItemStatus(itemId, status, {
      reason: "reason" in result ? (result.reason ?? null) : null,
      mediaAssetId: "mediaAssetId" in result ? result.mediaAssetId : null,
      title: "title" in result ? (result.title ?? item.title) : item.title,
    });
    await recountJobFailures(item.jobId);
    if (status === "failed") {
      return { ok: false, message: "reason" in result ? result.reason : "Retry failed" };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Retry failed";
    await markItemStatus(itemId, "failed", { reason: message });
    await recountJobFailures(item.jobId);
    return { ok: false, message };
  }
}
