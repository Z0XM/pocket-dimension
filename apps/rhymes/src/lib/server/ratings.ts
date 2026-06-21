import { db, schema } from "@pocket-dimension/db";
import { and, eq, sql } from "drizzle-orm";
import { logPieceEvent } from "$lib/server/events";

export function normalizeReaderRating(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 10) {
    throw new Error("Rating must be an integer between 0 and 10");
  }
  return value;
}

export async function upsertReaderRating(pieceId: string, userId: string, rating: number) {
  const normalizedRating = normalizeReaderRating(rating);

  await db
    .insert(schema.rhymesPieceRatings)
    .values({ pieceId, userId, rating: normalizedRating })
    .onConflictDoUpdate({
      target: [schema.rhymesPieceRatings.pieceId, schema.rhymesPieceRatings.userId],
      set: { rating: normalizedRating, updatedAt: sql`now()` },
    });

  const [aggregate] = await db
    .select({
      average: sql<string>`round(avg(${schema.rhymesPieceRatings.rating})::numeric, 2)`,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.rhymesPieceRatings)
    .where(eq(schema.rhymesPieceRatings.pieceId, pieceId));

  await db
    .update(schema.rhymesPieces)
    .set({
      readerAverageRating: aggregate?.average ?? null,
      readerRatingCount: aggregate?.count ?? 0,
    })
    .where(eq(schema.rhymesPieces.id, pieceId));

  await logPieceEvent(pieceId, userId, "rated", { rating: normalizedRating });

  return {
    rating: normalizedRating,
    readerAverageRating: aggregate?.average ? Number(aggregate.average) : null,
    readerRatingCount: aggregate?.count ?? 0,
  };
}

export async function getUserRatingForPiece(pieceId: string, userId: string) {
  const [rating] = await db
    .select()
    .from(schema.rhymesPieceRatings)
    .where(and(eq(schema.rhymesPieceRatings.pieceId, pieceId), eq(schema.rhymesPieceRatings.userId, userId)))
    .limit(1);

  return rating?.rating ?? null;
}
