import { db, schema } from "@pocket-dimension/db";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { IngestItemResult } from "$lib/server/ingest/pipeline";
import type { SongProgress } from "$lib/server/ingest/progress";
import { getJobLiveSongs } from "./live-progress";

export type ImportJobKind = "url" | "youtube_playlist" | "upload";
export type ImportJobStatus = "queued" | "running" | "completed" | "failed";
export type ImportJobItemStatus = "pending" | "running" | "imported" | "reused" | "skipped" | "unavailable" | "failed";

export type ImportJobSource = {
  url?: string;
  playlistIds?: string[];
  tagIds?: string[];
  customTags?: string[];
  sort?: string;
  skipExisting?: boolean;
  title?: string;
};

/** Per-song progress row for the Running Jobs UI (matches SongProgressList). */
export type ImportJobSongProgress = {
  identityKey: string;
  title: string | null;
  phase: string;
  percent: number;
};

export type ImportJobSummary = {
  id: string;
  kind: ImportJobKind;
  status: ImportJobStatus;
  label: string;
  total: number;
  done: number;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  unavailableCount: number;
  currentTitle: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
  /** Live / recent per-song progress for Active tab. */
  songs: ImportJobSongProgress[];
};

export type ImportJobItemSummary = {
  id: string;
  jobId: string;
  identityKey: string;
  title: string | null;
  status: ImportJobItemStatus;
  reason: string | null;
  sourceUrl: string | null;
  mediaAssetId: string | null;
  jobLabel: string;
};

function parseSource(raw: string | null): ImportJobSource {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ImportJobSource;
  } catch {
    return {};
  }
}

function toSummary(row: typeof schema.importJobs.$inferSelect, songs: ImportJobSongProgress[] = []): ImportJobSummary {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    label: row.label,
    total: row.total,
    done: row.done,
    importedCount: row.importedCount,
    skippedCount: row.skippedCount,
    failedCount: row.failedCount,
    unavailableCount: row.unavailableCount,
    currentTitle: row.currentTitle,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    songs,
  };
}

function itemStatusToPhase(status: ImportJobItemStatus): { phase: string; percent: number } {
  if (status === "imported" || status === "reused") return { phase: "done", percent: 100 };
  if (status === "skipped") return { phase: "skipped", percent: 100 };
  if (status === "unavailable") return { phase: "unavailable", percent: 100 };
  if (status === "failed") return { phase: "failed", percent: 0 };
  if (status === "running") return { phase: "downloading", percent: 0 };
  return { phase: "probing", percent: 0 };
}

function liveToSong(s: SongProgress): ImportJobSongProgress {
  return {
    identityKey: s.identityKey ?? "unknown",
    title: s.title ?? null,
    phase: s.phase,
    percent: s.percent,
  };
}

function mergeJobSongs(jobId: string, items: ImportJobSongProgress[], _status: ImportJobStatus): ImportJobSongProgress[] {
  const live = getJobLiveSongs(jobId).map(liveToSong);
  if (live.length === 0) {
    // Recently finished jobs / reload without in-process workers: show persisted items.
    return items.slice(-12);
  }
  const liveKeys = new Set(live.map((s) => s.identityKey));
  const recentDone = items.filter((s) => !liveKeys.has(s.identityKey)).slice(-8);
  // In-flight first (with live percent), then a few finished for context.
  return [...live, ...recentDone];
}

export async function createImportJob(opts: {
  userId: string;
  kind: ImportJobKind;
  label: string;
  source: ImportJobSource;
}): Promise<ImportJobSummary> {
  const [row] = await db
    .insert(schema.importJobs)
    .values({
      userId: opts.userId,
      kind: opts.kind,
      status: "queued",
      label: opts.label.slice(0, 200),
      sourceJson: JSON.stringify(opts.source),
    })
    .returning();
  if (!row) throw new Error("Failed to create import job");
  return toSummary(row);
}

export async function getImportJob(jobId: string, userId: string) {
  const row = await db.query.importJobs.findFirst({
    where: and(eq(schema.importJobs.id, jobId), eq(schema.importJobs.userId, userId)),
  });
  if (!row) return null;
  return { ...toSummary(row), source: parseSource(row.sourceJson), userId: row.userId, syncRunId: row.syncRunId };
}

export async function countRunningImportJobs(userId: string): Promise<number> {
  try {
    return await db.$count(
      schema.importJobs,
      and(eq(schema.importJobs.userId, userId), inArray(schema.importJobs.status, ["queued", "running"]))
    );
  } catch (err) {
    console.warn("[zap import-jobs] count failed (apply migration 0062?)", err);
    return 0;
  }
}

export async function listItemsForJobs(jobIds: string[], perJob = 40): Promise<Map<string, ImportJobSongProgress[]>> {
  const out = new Map<string, ImportJobSongProgress[]>();
  if (jobIds.length === 0) return out;
  const rows = await db
    .select({
      jobId: schema.importJobItems.jobId,
      identityKey: schema.importJobItems.identityKey,
      title: schema.importJobItems.title,
      status: schema.importJobItems.status,
      position: schema.importJobItems.position,
      updatedAt: schema.importJobItems.updatedAt,
    })
    .from(schema.importJobItems)
    .where(inArray(schema.importJobItems.jobId, jobIds))
    .orderBy(asc(schema.importJobItems.position), asc(schema.importJobItems.updatedAt));

  for (const row of rows) {
    const list = out.get(row.jobId) ?? [];
    const { phase, percent } = itemStatusToPhase(row.status);
    list.push({
      identityKey: row.identityKey,
      title: row.title,
      phase,
      percent,
    });
    out.set(row.jobId, list);
  }
  // Cap per job (keep newest by position order already — trim from the front for huge jobs).
  for (const [jobId, list] of out) {
    if (list.length > perJob) out.set(jobId, list.slice(list.length - perJob));
  }
  return out;
}

export async function listActiveImportJobs(userId: string, limit = 40): Promise<ImportJobSummary[]> {
  const rows = await db.query.importJobs.findMany({
    where: and(eq(schema.importJobs.userId, userId), inArray(schema.importJobs.status, ["queued", "running"])),
    orderBy: [desc(schema.importJobs.updatedAt)],
    limit,
  });
  // Also include recently finished (last hour) so the Active tab isn't empty right after completion.
  const recent = await db.query.importJobs.findMany({
    where: and(
      eq(schema.importJobs.userId, userId),
      inArray(schema.importJobs.status, ["completed", "failed"]),
      sql`${schema.importJobs.finishedAt} > now() - interval '1 hour'`
    ),
    orderBy: [desc(schema.importJobs.finishedAt)],
    limit: 20,
  });
  const seen = new Set(rows.map((r) => r.id));
  const merged = [...rows];
  for (const r of recent) {
    if (seen.has(r.id)) continue;
    merged.push(r);
  }
  const itemsByJob = await listItemsForJobs(merged.map((r) => r.id));
  return merged.map((row) => {
    const persisted = itemsByJob.get(row.id) ?? [];
    return toSummary(row, mergeJobSongs(row.id, persisted, row.status));
  });
}

export async function listFailedImportItems(userId: string, limit = 100): Promise<ImportJobItemSummary[]> {
  const rows = await db
    .select({
      id: schema.importJobItems.id,
      jobId: schema.importJobItems.jobId,
      identityKey: schema.importJobItems.identityKey,
      title: schema.importJobItems.title,
      status: schema.importJobItems.status,
      reason: schema.importJobItems.reason,
      sourceUrl: schema.importJobItems.sourceUrl,
      mediaAssetId: schema.importJobItems.mediaAssetId,
      jobLabel: schema.importJobs.label,
    })
    .from(schema.importJobItems)
    .innerJoin(schema.importJobs, eq(schema.importJobItems.jobId, schema.importJobs.id))
    .where(and(eq(schema.importJobs.userId, userId), eq(schema.importJobItems.status, "failed")))
    .orderBy(desc(schema.importJobItems.updatedAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    jobId: r.jobId,
    identityKey: r.identityKey,
    title: r.title,
    status: r.status,
    reason: r.reason,
    sourceUrl: r.sourceUrl,
    mediaAssetId: r.mediaAssetId,
    jobLabel: r.jobLabel,
  }));
}

export async function markJobRunning(jobId: string) {
  await db
    .update(schema.importJobs)
    .set({ status: "running", errorMessage: null, updatedAt: sql`now()` })
    .where(eq(schema.importJobs.id, jobId));
}

export async function updateJobProgress(
  jobId: string,
  patch: {
    total?: number;
    done?: number;
    importedCount?: number;
    skippedCount?: number;
    failedCount?: number;
    unavailableCount?: number;
    currentTitle?: string | null;
  }
) {
  await db
    .update(schema.importJobs)
    .set({
      ...(patch.total !== undefined ? { total: patch.total } : {}),
      ...(patch.done !== undefined ? { done: patch.done } : {}),
      ...(patch.importedCount !== undefined ? { importedCount: patch.importedCount } : {}),
      ...(patch.skippedCount !== undefined ? { skippedCount: patch.skippedCount } : {}),
      ...(patch.failedCount !== undefined ? { failedCount: patch.failedCount } : {}),
      ...(patch.unavailableCount !== undefined ? { unavailableCount: patch.unavailableCount } : {}),
      ...(patch.currentTitle !== undefined ? { currentTitle: patch.currentTitle } : {}),
      updatedAt: sql`now()`,
    })
    .where(eq(schema.importJobs.id, jobId));
}

export async function completeJob(
  jobId: string,
  opts: {
    status: "completed" | "failed";
    syncRunId?: string | null;
    errorMessage?: string | null;
    importedCount?: number;
    skippedCount?: number;
    failedCount?: number;
    unavailableCount?: number;
    total?: number;
    done?: number;
  }
) {
  await db
    .update(schema.importJobs)
    .set({
      status: opts.status,
      syncRunId: opts.syncRunId ?? undefined,
      errorMessage: opts.errorMessage ?? null,
      ...(opts.importedCount !== undefined ? { importedCount: opts.importedCount } : {}),
      ...(opts.skippedCount !== undefined ? { skippedCount: opts.skippedCount } : {}),
      ...(opts.failedCount !== undefined ? { failedCount: opts.failedCount } : {}),
      ...(opts.unavailableCount !== undefined ? { unavailableCount: opts.unavailableCount } : {}),
      ...(opts.total !== undefined ? { total: opts.total } : {}),
      ...(opts.done !== undefined ? { done: opts.done } : {}),
      currentTitle: null,
      finishedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(eq(schema.importJobs.id, jobId));
}

function itemStatusFromResult(result: IngestItemResult): ImportJobItemStatus {
  if (result.status === "imported") return "imported";
  if (result.status === "reused") return "reused";
  if (result.status === "skipped") return "skipped";
  if (result.status === "unavailable") return "unavailable";
  return "failed";
}

export async function recordIngestResult(
  jobId: string,
  result: IngestItemResult,
  opts?: { sourceUrl?: string | null; position?: number }
) {
  const identityKey = result.identityKey ?? "unknown";
  const status = itemStatusFromResult(result);
  const title = "title" in result ? (result.title ?? null) : null;
  const reason = "reason" in result ? (result.reason ?? null) : null;
  const mediaAssetId = "mediaAssetId" in result ? result.mediaAssetId : null;

  await db
    .insert(schema.importJobItems)
    .values({
      jobId,
      identityKey,
      title,
      status,
      reason,
      sourceUrl: opts?.sourceUrl ?? null,
      mediaAssetId: mediaAssetId ?? null,
      position: opts?.position ?? 0,
    })
    .onConflictDoUpdate({
      target: [schema.importJobItems.jobId, schema.importJobItems.identityKey],
      set: {
        title,
        status,
        reason,
        sourceUrl: opts?.sourceUrl ?? null,
        mediaAssetId: mediaAssetId ?? null,
        updatedAt: sql`now()`,
      },
    });
}

export async function getImportJobItem(itemId: string, userId: string) {
  const [row] = await db
    .select({
      id: schema.importJobItems.id,
      jobId: schema.importJobItems.jobId,
      identityKey: schema.importJobItems.identityKey,
      title: schema.importJobItems.title,
      status: schema.importJobItems.status,
      reason: schema.importJobItems.reason,
      sourceUrl: schema.importJobItems.sourceUrl,
      mediaAssetId: schema.importJobItems.mediaAssetId,
      userId: schema.importJobs.userId,
    })
    .from(schema.importJobItems)
    .innerJoin(schema.importJobs, eq(schema.importJobItems.jobId, schema.importJobs.id))
    .where(and(eq(schema.importJobItems.id, itemId), eq(schema.importJobs.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function markItemStatus(
  itemId: string,
  status: ImportJobItemStatus,
  patch?: { reason?: string | null; mediaAssetId?: string | null; title?: string | null }
) {
  await db
    .update(schema.importJobItems)
    .set({
      status,
      ...(patch?.reason !== undefined ? { reason: patch.reason } : {}),
      ...(patch?.mediaAssetId !== undefined ? { mediaAssetId: patch.mediaAssetId } : {}),
      ...(patch?.title !== undefined ? { title: patch.title } : {}),
      updatedAt: sql`now()`,
    })
    .where(eq(schema.importJobItems.id, itemId));
}

export async function recountJobFailures(jobId: string) {
  const failed = await db.$count(
    schema.importJobItems,
    and(eq(schema.importJobItems.jobId, jobId), eq(schema.importJobItems.status, "failed"))
  );
  await db
    .update(schema.importJobs)
    .set({ failedCount: failed, updatedAt: sql`now()` })
    .where(eq(schema.importJobs.id, jobId));
  return failed;
}
