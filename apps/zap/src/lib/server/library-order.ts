import { db, schema } from "@pocket-dimension/db";
import { and, eq, inArray, sql } from "drizzle-orm";

/** Next sort key base for appending an ordered import batch. */
export async function nextLibrarySortBase(userId: string): Promise<number> {
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${schema.userLibraryEntries.sortKey}), 0)::int` })
    .from(schema.userLibraryEntries)
    .where(eq(schema.userLibraryEntries.userId, userId));
  return (row?.max ?? 0) + 1000;
}

/**
 * Upsert library order for assets in the given sequence (index 0 = earliest).
 * Does not shuffle unrelated entries; only touches listed asset ids.
 */
export async function setUserLibraryOrder(opts: { userId: string; mediaAssetIds: string[]; syncRunId?: string | null }) {
  const ids = [...new Set(opts.mediaAssetIds.filter(Boolean))];
  if (ids.length === 0) return;

  const base = await nextLibrarySortBase(opts.userId);

  for (let i = 0; i < ids.length; i++) {
    const mediaAssetId = ids[i]!;
    const sortKey = base + i;
    await db
      .insert(schema.userLibraryEntries)
      .values({
        userId: opts.userId,
        mediaAssetId,
        sortKey,
        sourceSyncRunId: opts.syncRunId ?? null,
      })
      .onConflictDoUpdate({
        target: [schema.userLibraryEntries.userId, schema.userLibraryEntries.mediaAssetId],
        set: {
          sortKey,
          sourceSyncRunId: opts.syncRunId ?? null,
          updatedAt: sql`now()`,
        },
      });
  }
}

export async function getUserLibrarySortMap(userId: string, mediaAssetIds: string[]) {
  if (mediaAssetIds.length === 0) return new Map<string, number>();
  const rows = await db
    .select({
      mediaAssetId: schema.userLibraryEntries.mediaAssetId,
      sortKey: schema.userLibraryEntries.sortKey,
    })
    .from(schema.userLibraryEntries)
    .where(and(eq(schema.userLibraryEntries.userId, userId), inArray(schema.userLibraryEntries.mediaAssetId, mediaAssetIds)));
  return new Map(rows.map((r) => [r.mediaAssetId, r.sortKey]));
}
