import { db, schema } from "@pocket-dimension/db";
import { and, desc, eq } from "drizzle-orm";

export type LibraryActivityEntry =
  | {
      id: string;
      kind: "upload";
      at: string;
      title: string;
      mediaAssetId: string;
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
    };

export function parseSyncSummary(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as {
      playlists?: string[] | { id: string; title: string }[];
      playlistTitles?: string[];
      items?: { title?: string; status?: string }[];
      tagIds?: string[];
    };
  } catch {
    return null;
  }
}

export function playlistLabel(
  sourceUrl: string,
  summary: ReturnType<typeof parseSyncSummary>
): {
  kind: "playlist_import" | "url_import";
  label: string;
  playlistTitles?: string[];
} {
  if (sourceUrl.startsWith("youtube:connected:")) {
    const titlesFromSummary =
      summary?.playlistTitles ??
      (Array.isArray(summary?.playlists) ? summary.playlists.map((p) => (typeof p === "string" ? p : p.title)).filter(Boolean) : []);
    const label =
      titlesFromSummary.length > 0
        ? titlesFromSummary.join(", ")
        : sourceUrl.slice("youtube:connected:".length).split(",").filter(Boolean).join(", ") || "YouTube playlists";
    return { kind: "playlist_import", label, playlistTitles: titlesFromSummary.length ? titlesFromSummary : undefined };
  }
  return { kind: "url_import", label: sourceUrl };
}

/** Recent uploads + sync runs for the signed-in user. */
export async function listUserLibraryActivity(userId: string, limit = 40): Promise<LibraryActivityEntry[]> {
  const [runs, uploads] = await Promise.all([
    db.query.syncRuns.findMany({
      where: eq(schema.syncRuns.userId, userId),
      orderBy: [desc(schema.syncRuns.createdAt)],
      limit,
    }),
    db.query.mediaAssets.findMany({
      where: and(eq(schema.mediaAssets.addedByUserId, userId), eq(schema.mediaAssets.sourceType, "upload")),
      orderBy: [desc(schema.mediaAssets.createdAt)],
      limit,
    }),
  ]);

  const entries: LibraryActivityEntry[] = [];

  for (const run of runs) {
    const summary = parseSyncSummary(run.summaryJson);
    const meta = playlistLabel(run.sourceUrl, summary);
    const songTitles = (summary?.items ?? [])
      .filter((i) => i.status === "imported" || i.status === "reused")
      .map((i) => i.title)
      .filter((t): t is string => Boolean(t))
      .slice(0, 8);
    entries.push({
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
    });
  }

  for (const asset of uploads) {
    entries.push({
      id: `upload:${asset.id}`,
      kind: "upload",
      at: asset.createdAt.toISOString(),
      title: asset.title,
      mediaAssetId: asset.id,
    });
  }

  entries.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return entries.slice(0, limit);
}
