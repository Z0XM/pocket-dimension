import { db, schema } from "@pocket-dimension/db";
import { desc, eq, inArray } from "drizzle-orm";

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
};

export async function listPlayHistory(userId: string, limit = 50): Promise<PlayHistoryEntry[]> {
  const events = await db.query.playEvents.findMany({
    where: eq(schema.playEvents.userId, userId),
    orderBy: [desc(schema.playEvents.playedAt)],
    limit,
  });
  if (events.length === 0) return [];

  const assetIds = [...new Set(events.map((e) => e.mediaAssetId))];
  const assets = await db.query.mediaAssets.findMany({
    where: inArray(schema.mediaAssets.id, assetIds),
  });
  const byId = new Map(assets.map((a) => [a.id, a]));

  return events.map((e) => {
    const asset = byId.get(e.mediaAssetId);
    return {
      id: e.id,
      at: e.playedAt.toISOString(),
      mediaAssetId: e.mediaAssetId,
      title: asset?.title ?? "Unknown track",
      artists: asset?.artists ?? null,
      sessionId: e.sessionId,
    };
  });
}
