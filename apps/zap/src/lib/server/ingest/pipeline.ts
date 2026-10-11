import { db, schema } from "@pocket-dimension/db";
import { eq } from "drizzle-orm";
import { isStorageConfigured, putMediaObject } from "$lib/server/storage";
import { DURATION_CAP_MESSAGE, isOverDurationCap } from "./limits";
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
  errorMessage?: string;
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

/** Single catalogue video ingest (no sync_run row) — used by URL paste + connected playlist import. */
export async function ingestCatalogueVideo(opts: {
  userId: string;
  url: string;
  identityKey: string;
  titleHint?: string;
}): Promise<IngestItemResult> {
  const { userId, url, identityKey } = opts;

  const existingAsset = await findReadyAsset(identityKey);
  if (existingAsset?.status === "ready" && existingAsset.storageKey) {
    return {
      status: "reused",
      mediaAssetId: existingAsset.id,
      identityKey,
      title: existingAsset.title,
    };
  }

  if (!(await resolveYtDlpBin())) {
    return { status: "failed", reason: "yt-dlp is not installed", identityKey, title: opts.titleHint };
  }
  if (!isStorageConfigured()) {
    return { status: "failed", reason: "Object storage is not configured", identityKey, title: opts.titleHint };
  }

  const claim = await claimFetchJob(identityKey, url);
  if (claim.kind === "ready" && claim.job.mediaAssetId) {
    const asset = await findReadyAsset(identityKey);
    if (asset?.status === "ready") {
      return { status: "reused", mediaAssetId: asset.id, identityKey, title: asset.title };
    }
  }
  if (claim.kind === "running") {
    const asset = await waitForReadyAsset(identityKey);
    if (asset?.status === "ready" && asset.storageKey) {
      return { status: "reused", mediaAssetId: asset.id, identityKey, title: asset.title };
    }
    return { status: "failed", reason: "Concurrent fetch did not finish", identityKey, title: opts.titleHint };
  }

  let workDir: string | null = null;
  try {
    // Probe first for duration gate (also re-checked in download)
    const probe = await probeUrl(url);
    if (isOverDurationCap(probe.durationMs)) {
      await db.update(schema.fetchJobs).set({ status: "failed", errorMessage: DURATION_CAP_MESSAGE }).where(eq(schema.fetchJobs.id, claim.job.id));
      return { status: "skipped", reason: DURATION_CAP_MESSAGE, identityKey, title: probe.title };
    }

    const downloaded = await downloadBestAudio(url);
    workDir = downloaded.workDir;

    const put = await putMediaObject({
      identityKey,
      body: downloaded.bytes,
      contentType: downloaded.contentType,
      ext: downloaded.ext,
    });

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
          artists: downloaded.probe.uploader,
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
          artists: downloaded.probe.uploader,
          durationMs: downloaded.probe.durationMs,
          codec: downloaded.contentType,
          errorMessage: null,
        })
        .where(eq(schema.mediaAssets.id, asset.id))
        .returning();
      asset = updated!;
    }

    await db
      .update(schema.fetchJobs)
      .set({ status: "ready", mediaAssetId: asset.id, errorMessage: null })
      .where(eq(schema.fetchJobs.id, claim.job.id));

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
      return { status: "skipped", reason: message, identityKey, title: opts.titleHint };
    }
    return { status: "failed", reason: message, identityKey, title: opts.titleHint };
  } finally {
    if (workDir) await cleanupWorkDir(workDir);
  }
}

export async function ingestPublicUrl(userId: string, rawUrl: string): Promise<SyncRunResult> {
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
        });
        items.push(result);
      }
    } else if (parsed.kind === "youtube_video") {
      items.push(
        await ingestCatalogueVideo({
          userId,
          url: parsed.canonicalUrl,
          identityKey: parsed.identityKey,
        })
      );
    } else {
      items.push(
        await ingestCatalogueVideo({
          userId,
          url: parsed.canonicalUrl,
          identityKey: parsed.identityKey,
        })
      );
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
        summaryJson: JSON.stringify(items),
        finishedAt: new Date(),
      })
      .where(eq(schema.syncRuns.id, run.id));

    return { syncRunId: run.id, imported, skipped, failed, items };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    await db
      .update(schema.syncRuns)
      .set({
        status: "failed",
        errorMessage: message,
        importedCount: items.filter((i) => i.status === "imported" || i.status === "reused").length,
        skippedCount: items.filter((i) => i.status === "skipped").length,
        failedCount: items.filter((i) => i.status === "failed").length + (items.length === 0 ? 1 : 0),
        summaryJson: JSON.stringify(items),
        finishedAt: new Date(),
      })
      .where(eq(schema.syncRuns.id, run.id));

    if (err instanceof IngestError) throw err;
    throw new IngestError(message, 502);
  }
}
