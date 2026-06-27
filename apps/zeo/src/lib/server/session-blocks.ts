import { db, schema } from "@pocket-dimension/db";
import { and, eq } from "drizzle-orm";

export async function isParticipantBlocked(roomId: string, participantIdentity: string) {
  const block = await db.query.roomSessionBlocks.findFirst({
    where: and(eq(schema.roomSessionBlocks.roomId, roomId), eq(schema.roomSessionBlocks.participantIdentity, participantIdentity)),
  });
  return Boolean(block);
}

export async function blockParticipant(options: { roomId: string; participantIdentity: string; blockedById: string }) {
  await db
    .insert(schema.roomSessionBlocks)
    .values({
      roomId: options.roomId,
      participantIdentity: options.participantIdentity,
      blockedById: options.blockedById,
      reason: "removed",
    })
    .onConflictDoNothing();
}
