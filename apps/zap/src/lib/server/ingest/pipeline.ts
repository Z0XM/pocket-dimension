import { db, schema } from "@pocket-dimension/db";
import { eq } from "drizzle-orm";
import { addUserAssetTags } from "$lib/server/catalogue";
import { isStorageConfigured, putMediaObject } from "$lib/server/storage";
import { classifyUnavailableReason, isPlaceholderVideoTitle, placeholderUnavailableReason, summarizeIngestItems } from "./errors";
import { DURATION_CAP_MESSAGE, isOverDurationCap } from "./limits";
import type { SongProgress } from "./progress";
import { parseMediaUrl } from "./url-parse";
import { cleanupWorkDir, downloadBestAudio, getYtDlpCookiesSource, listPlaylistEntries, probeUrl, resolveYtDlpBin, YtDlpError } from "./ytdlp";

export type IngestItemResult =
  | { status: "imported"; mediaAssetId: string; identityKey: string; title: string }
  | { status: "reused"; mediaAssetId: string; identityKey: string; title: string }
  /** Catalogue row saved with metadata only (deleted/private/blocked source). */
  | { status: "unavailable"; mediaAssetId: string; identityKey: string; title: string; reason: string }
  | { status: "skipped"; reason: string; identityKey?: string; title?: string }
  | { status: "failed"; reason: string; identityKey?: string; title?: string };

/** Results that produced a catalogue row the user can tag / order. */
export function hasCatalogueAsset(item: IngestItemResult): item is Extract<IngestItemResult, { mediaAssetId: string }> {
  return item.status === "imported" || item.status === "reused" || item.status === "unavailable";
}

export type SyncRunResult = {
  syncRunId: string;
  imported: number;
  unavailable: number;
  skipped: number;
  failed: number;
  items: IngestItemResult[];
  errorMessage?: string | null;
  failures?: { title?: string; identityKey?: string; reason: string }[];
};

export class IngestError extends Error {
  constructor(
    message: string,
    readonly status: number = 400
  ) {
    super(message);
    this.name = "IngestError";
  }
}

async function findReadyAsset(identityKey: string) {
  return db.query.mediaAssets.findFirst({
    where: eq(schema.mediaAssets.identityKey, identityKey),
  });
}

/** yt-dlp + upload can take several minutes; waiters must outlive a typical download. */
const FETCH_JOB_STALE_MS = 20 * 60 * 1000;
const WAIT_FOR_READY_MAX_MS = 18 * 60 * 1000;
const WAIT_FOR_READY_POLL_MS = 1_000;

function isFetchJobStale(job: { updatedAt: Date; createdAt: Date }) {
  const t = (job.updatedAt ?? job.createdAt).getTime();
  return Number.isFinite(t) && Date.now() - t > FETCH_JOB_STALE_MS;
}

async function claimFetchJob(identityKey: string, sourceUrl: string) {
  const existing = await db.query.fetchJobs.findFirst({
    where: eq(schema.fetchJobs.identityKey, identityKey),
  });

  if (existing?.status === "ready" && existing.mediaAssetId) {
    return { kind: "ready" as const, job: existing };
  }
  if (existing?.status === "running" && !isFetchJobStale(existing)) {
    return { kind: "running" as const, job: existing };
  }

  if (existing) {
    // Reclaim failed / stale-running / pending rows.
    const [job] = await db
      .update(schema.fetchJobs)
      .set({ status: "running", sourceUrl, errorMessage: null, updatedAt: new Date() })
      .where(eq(schema.fetchJobs.id, existing.id))
      .returning();
    return { kind: "claimed" as const, job: job! };
  }

  try {
    const [job] = await db.insert(schema.fetchJobs).values({ identityKey, status: "running", sourceUrl }).returning();
    return { kind: "claimed" as const, job: job! };
  } catch {
    // Unique race: another worker inserted first — join their run.
    const raced = await db.query.fetchJobs.findFirst({
      where: eq(schema.fetchJobs.identityKey, identityKey),
    });
    if (raced?.status === "ready" && raced.mediaAssetId) return { kind: "ready" as const, job: raced };
    if (raced) return { kind: "running" as const, job: raced };
    throw new Error("Could not claim fetch job");
  }
}

async function waitForReadyAsset(identityKey: string, maxMs = WAIT_FOR_READY_MAX_MS): Promise<typeof schema.mediaAssets.$inferSelect | null> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const asset = await findReadyAsset(identityKey);
    if (asset?.status === "ready") return asset;
    if (asset?.status === "failed") return asset;
    if (asset?.status === "unavailable") return asset;
    const job = await db.query.fetchJobs.findFirst({ where: eq(schema.fetchJobs.identityKey, identityKey) });
    if (job?.status === "failed") return null;
    if (job?.status === "ready" && job.mediaAssetId) {
      return (await findReadyAsset(identityKey)) ?? null;
    }
    // Primary worker died without updating the job — stop waiting so caller can reclaim.
    if (!job || (job.status === "running" && isFetchJobStale(job))) return null;
    await Bun.sleep(WAIT_FOR_READY_POLL_MS);
  }
  return null;
}

/** Same-process coalesce so parallel playlist workers share one yt-dlp run per identity. */
const inflightCatalogueIngest = new Map<string, Promise<IngestItemResult>>();

export type IngestMetaHints = {
  description?: string | null;
  channelTitle?: string | null;
  channelId?: string | null;
};

export function coalesceMeta(
  probe: { description: string | null; channelTitle: string | null; channelId: string | null; uploader: string | null },
  hints?: IngestMetaHints
) {
  const channelTitle = probe.channelTitle ?? hints?.channelTitle ?? probe.uploader ?? null;
  return {
    description: probe.description ?? hints?.description ?? null,
    channelTitle,
    channelId: probe.channelId ?? hints?.channelId ?? null,
    artists: probe.uploader ?? channelTitle,
  };
}

async function backfillMissingChannelMeta(
  asset: typeof schema.mediaAssets.$inferSelect,
  hints?: IngestMetaHints
): Promise<typeof schema.mediaAssets.$inferSelect> {
  if (!hints) return asset;
  const next = {
    description: asset.description ?? hints.description ?? null,
    channelTitle: asset.channelTitle ?? hints.channelTitle ?? null,
    channelId: asset.channelId ?? hints.channelId ?? null,
  };
  if (next.description === asset.description && next.channelTitle === asset.channelTitle && next.channelId === asset.channelId) {
    return asset;
  }
  const [updated] = await db.update(schema.mediaAssets).set(next).where(eq(schema.mediaAssets.id, asset.id)).returning();
  return updated ?? asset;
}

/**
 * Save (or refresh) a metadata-only catalogue row for a source we cannot download.
 * Never downgrades a playable row. The row keeps its id + identity key, so a later
 * successful ingest of the same identity flips it to `ready` in place (see ingestCatalogueVideo).
 */
export async function saveUnavailableAsset(input: {
  userId: string;
  identityKey: string;
  url: string;
  title?: string | null;
  reason: string;
  metaHints?: IngestMetaHints;
  durationMs?: number | null;
}): Promise<typeof schema.mediaAssets.$inferSelect> {
  const { identityKey } = input;
  const hints = input.metaHints;
  const titleHint = input.title?.trim() || null;
  const existing = await findReadyAsset(identityKey);
  if (existing) {
    if (existing.storageKey && (existing.status === "ready" || existing.status === "archived")) {
      if (existing.status === "archived") {
        const [restored] = await db
          .update(schema.mediaAssets)
          .set({ status: "ready", errorMessage: null })
          .where(eq(schema.mediaAssets.id, existing.id))
          .returning();
        return restored ?? existing;
      }
      return existing;
    }
    const [updated] = await db
      .update(schema.mediaAssets)
      .set({
        status: "unavailable",
        errorMessage: input.reason,
        title: titleHint && isPlaceholderVideoTitle(existing.title) && !isPlaceholderVideoTitle(titleHint) ? titleHint : existing.title,
        description: existing.description ?? hints?.description ?? null,
        channelTitle: existing.channelTitle ?? hints?.channelTitle ?? null,
        channelId: existing.channelId ?? hints?.channelId ?? null,
        artists: existing.artists ?? hints?.channelTitle ?? null,
        durationMs: existing.durationMs ?? input.durationMs ?? null,
        externalUrl: existing.externalUrl ?? input.url,
      })
      .where(eq(schema.mediaAssets.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  const [inserted] = await db
    .insert(schema.mediaAssets)
    .values({
      identityKey,
      sourceType: identityKey.startsWith("youtube:") ? "youtube" : "url",
      status: "unavailable",
      storageKey: null,
      title: titleHint || "Untitled",
      artists: hints?.channelTitle ?? null,
      description: hints?.description ?? null,
      channelTitle: hints?.channelTitle ?? null,
      channelId: hints?.channelId ?? null,
      durationMs: input.durationMs ?? null,
      externalUrl: input.url,
      errorMessage: input.reason,
      addedByUserId: input.userId,
    })
    .onConflictDoNothing()
    .returning();
  if (inserted) return inserted;
  const raced = await findReadyAsset(identityKey);
  if (!raced) throw new Error("Could not save unavailable catalogue entry");
  return raced;
}

type IngestCatalogueVideoOpts = {
  userId: string;
  url: string;
  identityKey: string;
  titleHint?: string;
  metaHints?: IngestMetaHints;
  durationHint?: number | null;
  /**
   * Playlist paths know the item identity even when the source is gone: save deleted / private /
   * region-blocked items as `unavailable` catalogue rows instead of reporting them as failed.
   */
  recordUnavailable?: boolean;
  /** Pre-flight reason from playlist metadata (e.g. API says private/deleted) — skips yt-dlp. */
  unavailableReason?: string | null;
  onSongProgress?: (progress: SongProgress) => void | Promise<void>;
};

/** Single catalogue video ingest (no sync_run row) — used by URL paste + connected playlist import. */
export async function ingestCatalogueVideo(opts: IngestCatalogueVideoOpts): Promise<IngestItemResult> {
  const existing = inflightCatalogueIngest.get(opts.identityKey);
  if (existing) return existing;

  const promise = ingestCatalogueVideoOnce(opts).finally(() => {
    if (inflightCatalogueIngest.get(opts.identityKey) === promise) {
      inflightCatalogueIngest.delete(opts.identityKey);
    }
  });
  inflightCatalogueIngest.set(opts.identityKey, promise);
  return promise;
}

async function ingestCatalogueVideoOnce(opts: IngestCatalogueVideoOpts): Promise<IngestItemResult> {
  const { userId, url, identityKey } = opts;
  const emit = async (phase: SongProgress["phase"], percent: number, title?: string | null) => {
    await opts.onSongProgress?.({
      identityKey,
      title: title ?? opts.titleHint ?? null,
      phase,
      percent,
    });
  };

  const markUnavailable = async (reason: string): Promise<IngestItemResult> => {
    const asset = await saveUnavailableAsset({
      userId,
      identityKey,
      url,
      title: opts.titleHint,
      reason,
      metaHints: opts.metaHints,
      durationMs: opts.durationHint,
    });
    if (asset.status === "ready" && asset.storageKey) {
      await emit("done", 100, asset.title);
      return { status: "reused", mediaAssetId: asset.id, identityKey, title: asset.title };
    }
    await emit("unavailable", 100, asset.title);
    return { status: "unavailable", mediaAssetId: asset.id, identityKey, title: asset.title, reason };
  };

  const existingAsset = await findReadyAsset(identityKey);
  if (existingAsset?.storageKey && (existingAsset.status === "ready" || existingAsset.status === "archived")) {
    let asset = existingAsset;
    if (existingAsset.status === "archived") {
      const [restored] = await db
        .update(schema.mediaAssets)
        .set({ status: "ready", errorMessage: null })
        .where(eq(schema.mediaAssets.id, existingAsset.id))
        .returning();
      asset = restored ?? existingAsset;
    }
    asset = await backfillMissingChannelMeta(asset, opts.metaHints);
    await emit("done", 100, asset.title);
    return {
      status: "reused",
      mediaAssetId: asset.id,
      identityKey,
      title: asset.title,
    };
  }

  if (opts.recordUnavailable && opts.unavailableReason) {
    return markUnavailable(opts.unavailableReason);
  }

  if (!(await resolveYtDlpBin())) {
    console.error("[zap ingest] failed", { identityKey, reason: "yt-dlp is not installed" });
    await emit("failed", 0);
    return { status: "failed", reason: "yt-dlp is not installed", identityKey, title: opts.titleHint };
  }
  if (!isStorageConfigured()) {
    console.error("[zap ingest] failed", { identityKey, reason: "Object storage is not configured" });
    await emit("failed", 0);
    return { status: "failed", reason: "Object storage is not configured", identityKey, title: opts.titleHint };
  }

  let claim = await claimFetchJob(identityKey, url);
  if (claim.kind === "ready" && claim.job.mediaAssetId) {
    const asset = await findReadyAsset(identityKey);
    if (asset?.status === "ready") {
      await emit("done", 100, asset.title);
      return { status: "reused", mediaAssetId: asset.id, identityKey, title: asset.title };
    }
  }
  if (claim.kind === "running") {
    const asset = await waitForReadyAsset(identityKey);
    if (asset?.status === "ready" && asset.storageKey) {
      await emit("done", 100, asset.title);
      return { status: "reused", mediaAssetId: asset.id, identityKey, title: asset.title };
    }
    if (opts.recordUnavailable) {
      const settled = asset ?? (await findReadyAsset(identityKey));
      if (settled?.status === "unavailable") {
        return markUnavailable(settled.errorMessage ?? "Video unavailable");
      }
    }
    // Wait timed out or primary went stale — try to reclaim once instead of dropping the track.
    claim = await claimFetchJob(identityKey, url);
    if (claim.kind === "running") {
      const retried = await waitForReadyAsset(identityKey, 60_000);
      if (retried?.status === "ready" && retried.storageKey) {
        await emit("done", 100, retried.title);
        return { status: "reused", mediaAssetId: retried.id, identityKey, title: retried.title };
      }
      console.error("[zap ingest] failed", { identityKey, reason: "Concurrent fetch did not finish" });
      await emit("failed", 0);
      return { status: "failed", reason: "Concurrent fetch did not finish", identityKey, title: opts.titleHint };
    }
    if (claim.kind === "ready" && claim.job.mediaAssetId) {
      const ready = await findReadyAsset(identityKey);
      if (ready?.status === "ready") {
        await emit("done", 100, ready.title);
        return { status: "reused", mediaAssetId: ready.id, identityKey, title: ready.title };
      }
    }
    // claim.kind === "claimed" — fall through and run yt-dlp ourselves
  }

  let workDir: string | null = null;
  try {
    await emit("probing", 0);
    // Probe first for duration gate (also re-checked in download)
    const probe = await probeUrl(url);
    if (isOverDurationCap(probe.durationMs)) {
      await db.update(schema.fetchJobs).set({ status: "failed", errorMessage: DURATION_CAP_MESSAGE }).where(eq(schema.fetchJobs.id, claim.job.id));
      await emit("skipped", 100, probe.title);
      return { status: "skipped", reason: DURATION_CAP_MESSAGE, identityKey, title: probe.title };
    }

    await emit("downloading", 0, probe.title);
    const downloaded = await downloadBestAudio(url, {
      onDownloadPercent: (percent) => {
        void emit("downloading", percent, probe.title);
      },
    });
    workDir = downloaded.workDir;
    await emit("downloading", 100, downloaded.probe.title);

    await emit("uploading", 0, downloaded.probe.title);
    const put = await putMediaObject({
      identityKey,
      body: downloaded.bytes,
      contentType: downloaded.contentType,
      ext: downloaded.ext,
      onUploadPercent: (percent) => {
        void emit("uploading", percent, downloaded.probe.title);
      },
    });
    await emit("uploading", 100, downloaded.probe.title);
    await emit("finalizing", 50, downloaded.probe.title);

    const meta = coalesceMeta(downloaded.probe, opts.metaHints);
    let asset = await findReadyAsset(identityKey);
    if (!asset) {
      const [inserted] = await db
        .insert(schema.mediaAssets)
        .values({
          identityKey,
          sourceType: identityKey.startsWith("youtube:") ? "youtube" : "url",
          status: "ready",
          storageKey: put.storageKey,
          title: downloaded.probe.title || opts.titleHint || "Untitled",
          artists: meta.artists,
          description: meta.description,
          channelTitle: meta.channelTitle,
          channelId: meta.channelId,
          durationMs: downloaded.probe.durationMs,
          codec: downloaded.contentType,
          externalUrl: downloaded.probe.webpageUrl ?? url,
          addedByUserId: userId,
        })
        .returning();
      asset = inserted!;
    } else if (asset.status !== "ready") {
      const [updated] = await db
        .update(schema.mediaAssets)
        .set({
          status: "ready",
          storageKey: put.storageKey,
          title: downloaded.probe.title || asset.title,
          artists: meta.artists ?? asset.artists,
          description: asset.description ?? meta.description,
          channelTitle: asset.channelTitle ?? meta.channelTitle,
          channelId: asset.channelId ?? meta.channelId,
          durationMs: downloaded.probe.durationMs,
          codec: downloaded.contentType,
          errorMessage: null,
        })
        .where(eq(schema.mediaAssets.id, asset.id))
        .returning();
      asset = updated!;
    } else {
      asset = await backfillMissingChannelMeta(asset, {
        description: meta.description,
        channelTitle: meta.channelTitle,
        channelId: meta.channelId,
      });
    }

    await db
      .update(schema.fetchJobs)
      .set({ status: "ready", mediaAssetId: asset.id, errorMessage: null })
      .where(eq(schema.fetchJobs.id, claim.job.id));

    await emit("done", 100, asset.title);
    return {
      status: existingAsset?.storageKey ? "reused" : "imported",
      mediaAssetId: asset.id,
      identityKey,
      title: asset.title,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingest failed";
    const skipped = message.includes("10 minutes");
    await db.update(schema.fetchJobs).set({ status: "failed", errorMessage: message }).where(eq(schema.fetchJobs.id, claim.job.id));
    if (skipped) {
      await emit("skipped", 100);
      return { status: "skipped", reason: message, identityKey, title: opts.titleHint };
    }
    const unavailableReason = opts.recordUnavailable ? classifyUnavailableReason(message) : null;
    if (unavailableReason) {
      try {
        return await markUnavailable(unavailableReason);
      } catch (saveErr) {
        console.warn("[zap ingest] could not save unavailable entry", identityKey, saveErr);
      }
    }
    console.error("[zap ingest] failed", {
      identityKey,
      url,
      reason: message,
      cookies: getYtDlpCookiesSource(),
      ...(err instanceof YtDlpError ? { ytdlp: err.detail } : { error: err }),
    });
    await emit("failed", 0);
    return { status: "failed", reason: message, identityKey, title: opts.titleHint };
  } finally {
    if (workDir) await cleanupWorkDir(workDir);
  }
}

export async function ingestPublicUrl(
  userId: string,
  rawUrl: string,
  onSongProgress?: (progress: SongProgress) => void | Promise<void>,
  opts?: { tagIds?: string[] }
): Promise<SyncRunResult> {
  const parsed = parseMediaUrl(rawUrl);
  if (!parsed) throw new IngestError("Enter a valid http(s) URL");
  const tagIds = [...new Set((opts?.tagIds ?? []).filter(Boolean))];

  const [run] = await db
    .insert(schema.syncRuns)
    .values({
      userId,
      sourceUrl: parsed.canonicalUrl,
      status: "running",
    })
    .returning();

  if (!run) throw new IngestError("Failed to start sync run", 500);

  const items: IngestItemResult[] = [];
  const push = async (result: IngestItemResult) => {
    items.push(result);
    if (tagIds.length > 0 && hasCatalogueAsset(result)) {
      try {
        await addUserAssetTags(userId, result.mediaAssetId, tagIds);
      } catch (err) {
        console.warn("[zap ingest url tags]", result.mediaAssetId, err);
      }
    }
  };

  try {
    if (parsed.kind === "youtube_playlist") {
      const entries = await listPlaylistEntries(parsed.canonicalUrl);
      if (entries.length === 0) {
        throw new IngestError("Playlist is empty or private (connect YouTube OAuth in Phase 4 for private lists)");
      }
      for (const entry of entries) {
        // Flat playlist may already know duration — skip early without download
        if (isOverDurationCap(entry.durationMs)) {
          items.push({
            status: "skipped",
            reason: DURATION_CAP_MESSAGE,
            identityKey: `youtube:${entry.id}`,
            title: entry.title,
          });
          continue;
        }
        await push(
          await ingestCatalogueVideo({
            userId,
            url: entry.url,
            identityKey: `youtube:${entry.id}`,
            titleHint: entry.title,
            durationHint: entry.durationMs,
            recordUnavailable: true,
            unavailableReason: placeholderUnavailableReason(entry.title),
            onSongProgress,
          })
        );
      }
    } else {
      await push(
        await ingestCatalogueVideo({
          userId,
          url: parsed.canonicalUrl,
          identityKey: parsed.identityKey,
          onSongProgress,
        })
      );
    }

    const summary = summarizeIngestItems(items);

    await db
      .update(schema.syncRuns)
      .set({
        status: "completed",
        importedCount: summary.imported,
        unavailableCount: summary.unavailable,
        skippedCount: summary.skipped,
        failedCount: summary.failed,
        errorMessage: summary.errorMessage,
        summaryJson: JSON.stringify({ items, failures: summary.failures, unavailable: summary.unavailableItems, tagIds }),
        finishedAt: new Date(),
      })
      .where(eq(schema.syncRuns.id, run.id));

    return {
      syncRunId: run.id,
      imported: summary.imported,
      unavailable: summary.unavailable,
      skipped: summary.skipped,
      failed: summary.failed,
      items,
      errorMessage: summary.errorMessage,
      failures: summary.failures,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    console.error("[zap ingest] sync run failed", { syncRunId: run.id, sourceUrl: parsed.canonicalUrl }, err);
    const summary = summarizeIngestItems(items);
    await db
      .update(schema.syncRuns)
      .set({
        status: "failed",
        errorMessage: message,
        importedCount: summary.imported,
        unavailableCount: summary.unavailable,
        skippedCount: summary.skipped,
        failedCount: summary.failed + (items.length === 0 ? 1 : 0),
        summaryJson: JSON.stringify({ items, failures: summary.failures, unavailable: summary.unavailableItems, tagIds }),
        finishedAt: new Date(),
      })
      .where(eq(schema.syncRuns.id, run.id));

    if (err instanceof IngestError) throw err;
    throw new IngestError(message, 502);
  }
}
