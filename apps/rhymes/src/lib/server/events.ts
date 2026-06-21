import { db, schema } from "@pocket-dimension/db";
import { desc, eq } from "drizzle-orm";

export async function logPieceEvent(
  pieceId: string,
  actorId: string,
  action: string,
  payload: Record<string, unknown> | null = null
) {
  await db.insert(schema.rhymesPieceEvents).values({
    pieceId,
    actorId,
    action,
    payloadJson: payload,
  });
}

export async function listPieceEvents(pieceId: string, limit = 50) {
  return db
    .select()
    .from(schema.rhymesPieceEvents)
    .where(eq(schema.rhymesPieceEvents.pieceId, pieceId))
    .orderBy(desc(schema.rhymesPieceEvents.createdAt))
    .limit(limit);
}
