import { db, schema } from "@pocket-dimension/db";
import { eq } from "drizzle-orm";
import { isStorageConfigured, putMediaObject } from "$lib/server/storage";
import { summarizeIngestItems } from "./errors";
import { DURATION_CAP_MESSAGE, isOverDurationCap } from "./limits";
import type { SongProgress } from "./progress";
import { parseMediaUrl } from "./url-parse";
import { cleanupWorkDir, downloadBestAudio, listPlaylistEntries, probeUrl, resolveYtDlpBin } from "./ytdlp";

export type IngestItemResult =
  | { status: "imported"; mediaAssetId: string; identityKey: string; title: string }
  | { status: "reused"; mediaAssetId: string; identityKey: string; title: string }
  | { status: "skipped"; reason: string; identityKey?: string; title?: string }
  | { status: "failed"; reason: string; identityKey?: string; title?: string };

export type SyncRunResult = {
  syncRunId: string;
  imported: number;
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

async function claimFetchJob(identityKey: string, sourceUrl: string) {
  const existing = await db.query.fetchJobs.findFirst({
    where: eq(schema.fetchJobs.identityKey, identityKey),
  });

  if (existing?.status === "ready" && existing.mediaAssetId) {
    return { kind: "ready" as const, job: existing };
  }
  if (existing?.status === "running") {
    return { kind: "running" as const, job: existing };
  }

  if (existing) {
    const [job] = await db
      .update(schema.fetchJobs)
      .set({ status: "running", sourceUrl, errorMessage: null })
      .where(eq(schema.fetchJobs.id, existing.id))
      .returning();
    return { kind: "claimed" as const, job: job! };
  }

  const [job] = await db.insert(schema.fetchJobs).values({ identityKey, status: "running", sourceUrl }).returning();
  return { kind: "claimed" as const, job: job! };
}

async function waitForReadyAsset(identityKey: string, attempts = 30): Promise<typeof schema.mediaAssets.$inferSelect | null> {
  for (let i = 0; i < attempts; i++) {
    const asset = await findReadyAsset(identityKey);
    if (asset?.status === "ready") return asset;
    if (asset?.status === "failed") return asset;
    const job = await db.query.fetchJobs.findFirst({ where: eq(schema.fetchJobs.identityKey, identityKey) });
    if (job?.status === "failed") return null;
    if (job?.status === "ready" && job.mediaAssetId) {
      return (await findReadyAsset(identityKey)) ?? null;
    }
    await Bun.sleep(500);
  }
  return null;
}

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

/** Single catalogue video ingest (no sync_run row) — used by URL paste + connected playlist import. */
export async function ingestCatalogueVideo(opts: {
  userId: string;
  url: string;
  identityKey: string;
  titleHint?: string;
  metaHints?: IngestMetaHints;
  onSongProgress?: (progress: SongProgress) => void | Promise<void>;
}): Promise<IngestItemResult> {
  const { userId, url, identityKey } = opts;
  const emit = async (phase: SongProgress["phase"], percent: number, title?: string | null) => {
    await opts.onSongProgress?.({
      identityKey,
      title: title ?? opts.titleHint ?? null,
      phase,
      percent,
    });
  };

  const existingAsset = await findReadyAsset(identityKey);
  if (existingAsset?.status === "ready" && existingAsset.storageKey) {
    const asset = await backfillMissingChannelMeta(existingAsset, opts.metaHints);
    await emit("done", 100, asset.title);
    return {
      status: "reused",
      mediaAssetId: asset.id,
      identityKey,
      title: asset.title,
    };
  }

  if (!(await resolveYtDlpBin())) {
    await emit("failed", 0);
    return { status: "failed", reason: "yt-dlp is not installed", identityKey, title: opts.titleHint };
  }
  if (!isStorageConfigured()) {
    await emit("failed", 0);
    return { status: "failed", reason: "Object storage is not configured", identityKey, title: opts.titleHint };
  }

  const claim = await claimFetchJob(identityKey, url);
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
    await emit("failed", 0);
    return { status: "failed", reason: "Concurrent fetch did not finish", identityKey, title: opts.titleHint };
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
      status: existingAsset ? "reused" : "imported",
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
    await emit("failed", 0);
    return { status: "failed", reason: message, identityKey, title: opts.titleHint };
  } finally {
    if (workDir) await cleanupWorkDir(workDir);
  }
}

export async function ingestPublicUrl(
  userId: string,
  rawUrl: string,
  onSongProgress?: (progress: SongProgress) => void | Promise<void>
): Promise<SyncRunResult> {
  const parsed = parseMediaUrl(rawUrl);
  if (!parsed) throw new IngestError("Enter a valid http(s) URL");

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
        const result = await ingestCatalogueVideo({
          userId,
          url: entry.url,
          identityKey: `youtube:${entry.id}`,
          titleHint: entry.title,
          onSongProgress,
        });
        items.push(result);
      }
    } else if (parsed.kind === "youtube_video") {
      items.push(
        await ingestCatalogueVideo({
          userId,
          url: parsed.canonicalUrl,
          identityKey: parsed.identityKey,
          onSongProgress,
        })
      );
    } else {
      items.push(
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
        skippedCount: summary.skipped,
        failedCount: summary.failed,
        errorMessage: summary.errorMessage,
        summaryJson: JSON.stringify({ items, failures: summary.failures }),
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
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    const summary = summarizeIngestItems(items);
    await db
      .update(schema.syncRuns)
      .set({
        status: "failed",
        errorMessage: message,
        importedCount: summary.imported,
        skippedCount: summary.skipped,
        failedCount: summary.failed + (items.length === 0 ? 1 : 0),
        summaryJson: JSON.stringify({ items, failures: summary.failures }),
        finishedAt: new Date(),
      })
      .where(eq(schema.syncRuns.id, run.id));

    if (err instanceof IngestError) throw err;
    throw new IngestError(message, 502);
  }
}
