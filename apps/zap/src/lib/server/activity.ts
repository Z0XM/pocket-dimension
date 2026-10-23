import { db, schema } from "@pocket-dimension/db";
import { and, desc, eq, gte, ilike, lt, or, type SQL } from "drizzle-orm";
import { importLinks, parseSyncSummary, playlistLabel, type ActivityLink } from "$lib/activity-links";
import { songHref } from "$lib/history-time";

export type { ActivityLink };
export { importLinks, parseSyncSummary, playlistLabel };

export type LibraryActivityEntry =
  | {
      id: string;
      kind: "upload";
      at: string;
      title: string;
      mediaAssetId: string;
      href: string;
      links: null;
    }
  | {
      id: string;
      kind: "playlist_import" | "url_import";
      at: string;
      label: string;
      sourceUrl: string;
      status: string;
      imported: number;
      unavailable: number;
      skipped: number;
      failed: number;
      playlistTitles?: string[];
      songTitles?: string[];
      href: string | null;
      links: ActivityLink[] | null;
    };

export type LibraryActivityQuery = {
  userId: string;
  q?: string;
  since?: Date | null;
  before?: Date | null;
  limit?: number;
};

function where(...conditions: (SQL | undefined)[]) {
  const list = conditions.filter((c): c is SQL => Boolean(c));
  return list.length ? and(...list) : undefined;
}

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, (ch) => `\\${ch}`);
}

function syncMatchesQuery(run: { sourceUrl: string; summaryJson: string | null }, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  if (run.sourceUrl.toLowerCase().includes(needle)) return true;
  const summary = parseSyncSummary(run.summaryJson);
  const meta = playlistLabel(run.sourceUrl, summary);
  if (meta.label.toLowerCase().includes(needle)) return true;
  if (meta.playlistTitles?.some((t) => t.toLowerCase().includes(needle))) return true;
  const titles = (summary?.items ?? []).map((i) => i.title).filter(Boolean) as string[];
  return titles.some((t) => t.toLowerCase().includes(needle));
}

function toImportEntry(run: typeof schema.syncRuns.$inferSelect): Extract<LibraryActivityEntry, { kind: "playlist_import" | "url_import" }> {
  const summary = parseSyncSummary(run.summaryJson);
  const meta = playlistLabel(run.sourceUrl, summary);
  const songTitles = (summary?.items ?? [])
    .filter((i) => i.status === "imported" || i.status === "reused")
    .map((i) => i.title)
    .filter((t): t is string => Boolean(t))
    .slice(0, 8);
  const links = importLinks(run.sourceUrl, summary, meta);
  return {
    id: `sync:${run.id}`,
    kind: meta.kind,
    at: run.createdAt.toISOString(),
    label: meta.label,
    sourceUrl: run.sourceUrl,
    status: run.status,
    imported: run.importedCount,
    unavailable: run.unavailableCount,
    skipped: run.skippedCount,
    failed: run.failedCount,
    playlistTitles: meta.playlistTitles,
    songTitles: songTitles.length ? songTitles : undefined,
    href: links.length === 1 ? links[0]!.href : null,
    links: links.length ? links : null,
  };
}

function toUploadEntry(asset: typeof schema.mediaAssets.$inferSelect): Extract<LibraryActivityEntry, { kind: "upload" }> {
  return {
    id: `upload:${asset.id}`,
    kind: "upload",
    at: asset.createdAt.toISOString(),
    title: asset.title,
    mediaAssetId: asset.id,
    href: songHref(asset.externalUrl, asset.title, asset.id),
    links: null,
  };
}

/** Recent uploads + sync runs for the signed-in user (paginated, searchable). */
export async function listUserLibraryActivity(input: LibraryActivityQuery | string, legacyLimit?: number): Promise<LibraryActivityEntry[]> {
  // Back-compat for callers that still pass (userId, limit).
  if (typeof input === "string") {
    const page = await listUserLibraryActivityPage({ userId: input, limit: legacyLimit ?? 40 });
    return page.entries;
  }
  const page = await listUserLibraryActivityPage(input);
  return page.entries;
}

export async function listUserLibraryActivityPage(input: LibraryActivityQuery): Promise<{
  entries: LibraryActivityEntry[];
  nextBefore: string | null;
}> {
  const limit = Math.min(Math.max(input.limit ?? 40, 1), 100);
  const q = input.q?.trim() ?? "";
  const since = input.since ?? null;
  const before = input.before ?? null;
  // Over-fetch per source so in-memory search/merge still fills a page.
  const fetchLimit = q ? Math.min(limit * 4, 200) : limit;

  const uploadSearch = q
    ? or(
        ilike(schema.mediaAssets.title, `%${escapeLike(q)}%`),
        ilike(schema.mediaAssets.artists, `%${escapeLike(q)}%`),
        ilike(schema.mediaAssets.externalUrl, `%${escapeLike(q)}%`)
      )
    : undefined;

  const [runs, uploads] = await Promise.all([
    db.query.syncRuns.findMany({
      where: where(
        eq(schema.syncRuns.userId, input.userId),
        since ? gte(schema.syncRuns.createdAt, since) : undefined,
        before ? lt(schema.syncRuns.createdAt, before) : undefined
      ),
      orderBy: [desc(schema.syncRuns.createdAt)],
      limit: fetchLimit,
    }),
    db.query.mediaAssets.findMany({
      where: where(
        eq(schema.mediaAssets.addedByUserId, input.userId),
        eq(schema.mediaAssets.sourceType, "upload"),
        since ? gte(schema.mediaAssets.createdAt, since) : undefined,
        before ? lt(schema.mediaAssets.createdAt, before) : undefined,
        uploadSearch
      ),
      orderBy: [desc(schema.mediaAssets.createdAt)],
      limit: fetchLimit,
    }),
  ]);

  const entries: LibraryActivityEntry[] = [
    ...runs.filter((r) => syncMatchesQuery(r, q)).map(toImportEntry),
    ...uploads.map(toUploadEntry),
  ]
    .sort((a, b) => (a.at === b.at ? (a.id < b.id ? 1 : -1) : a.at < b.at ? 1 : -1))
    .slice(0, limit);

  const last = entries.at(-1);
  return { entries, nextBefore: entries.length === limit && last ? last.at : null };
}
