import { db, schema } from "@pocket-dimension/db";
import { and, desc, eq, gte, ilike, lt, or, type SQL } from "drizzle-orm";
import { songHref } from "$lib/history-time";

export async function recordPlayEvent(opts: { userId: string; mediaAssetId: string; sessionId?: string | null }) {
  if (!opts.mediaAssetId) return;
  try {
    await db.insert(schema.playEvents).values({
      userId: opts.userId,
      mediaAssetId: opts.mediaAssetId,
      sessionId: opts.sessionId ?? null,
    });
  } catch (err) {
    console.warn("[zap play history]", err);
  }
}

export type PlayHistoryEntry = {
  id: string;
  at: string;
  mediaAssetId: string;
  title: string;
  artists: string | null;
  sessionId: string | null;
  externalUrl: string | null;
  href: string;
  playable: boolean;
};

export type PlayHistoryQuery = {
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

export async function listPlayHistory(userId: string, limit = 50): Promise<PlayHistoryEntry[]> {
  const page = await listPlayHistoryPage({ userId, limit });
  return page.entries;
}

export async function listPlayHistoryPage(input: PlayHistoryQuery): Promise<{
  entries: PlayHistoryEntry[];
  nextBefore: string | null;
}> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const q = input.q?.trim() ?? "";
  const since = input.since ?? null;
  const before = input.before ?? null;

  const search = q
    ? or(
        ilike(schema.mediaAssets.title, `%${escapeLike(q)}%`),
        ilike(schema.mediaAssets.artists, `%${escapeLike(q)}%`),
        ilike(schema.mediaAssets.externalUrl, `%${escapeLike(q)}%`)
      )
    : undefined;

  const rows = await db
    .select({
      event: schema.playEvents,
      title: schema.mediaAssets.title,
      artists: schema.mediaAssets.artists,
      externalUrl: schema.mediaAssets.externalUrl,
      mediaAssetId: schema.mediaAssets.id,
      status: schema.mediaAssets.status,
      storageKey: schema.mediaAssets.storageKey,
    })
    .from(schema.playEvents)
    .innerJoin(schema.mediaAssets, eq(schema.mediaAssets.id, schema.playEvents.mediaAssetId))
    .where(
      where(
        eq(schema.playEvents.userId, input.userId),
        since ? gte(schema.playEvents.playedAt, since) : undefined,
        before ? lt(schema.playEvents.playedAt, before) : undefined,
        search
      )
    )
    .orderBy(desc(schema.playEvents.playedAt))
    .limit(limit);

  const entries: PlayHistoryEntry[] = rows.map((row) => {
    const title = row.title ?? "Unknown track";
    return {
      id: row.event.id,
      at: row.event.playedAt.toISOString(),
      mediaAssetId: row.mediaAssetId,
      title,
      artists: row.artists ?? null,
      sessionId: row.event.sessionId,
      externalUrl: row.externalUrl ?? null,
      href: songHref(row.externalUrl, title, row.mediaAssetId),
      playable: Boolean(row.storageKey) && row.status === "ready",
    };
  });

  const last = entries.at(-1);
  return { entries, nextBefore: entries.length === limit && last ? last.at : null };
}
