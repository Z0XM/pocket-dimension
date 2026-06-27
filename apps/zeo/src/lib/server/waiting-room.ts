import { db, schema } from "@pocket-dimension/db";
import { and, eq } from "drizzle-orm";

export async function findWaitingEntry(roomId: string, participantIdentity: string) {
  return db.query.roomWaitingEntries.findFirst({
    where: and(eq(schema.roomWaitingEntries.roomId, roomId), eq(schema.roomWaitingEntries.participantIdentity, participantIdentity)),
  });
}

export async function isWaitingRoomAdmitted(room: typeof schema.rooms.$inferSelect, participantIdentity: string) {
  if (!room.waitingRoomEnabled) return true;

  const entry = await findWaitingEntry(room.id, participantIdentity);
  return entry?.status === "admitted";
}

export async function requestWaitingRoomEntry(options: { roomId: string; participantIdentity: string; displayName: string }) {
  const existing = await findWaitingEntry(options.roomId, options.participantIdentity);

  if (existing?.status === "admitted") {
    return { status: "admitted" as const, entry: existing };
  }

  if (existing?.status === "denied") {
    return { status: "denied" as const, entry: existing };
  }

  if (existing?.status === "pending") {
    return { status: "pending" as const, entry: existing };
  }

  const [entry] = await db
    .insert(schema.roomWaitingEntries)
    .values({
      roomId: options.roomId,
      participantIdentity: options.participantIdentity,
      displayName: options.displayName,
      status: "pending",
    })
    .returning();

  return { status: "pending" as const, entry };
}

export async function listPendingWaitingEntries(roomId: string) {
  return db.query.roomWaitingEntries.findMany({
    where: and(eq(schema.roomWaitingEntries.roomId, roomId), eq(schema.roomWaitingEntries.status, "pending")),
    orderBy: (table, { asc }) => [asc(table.requestedAt)],
  });
}

export async function admitWaitingEntry(options: { roomId: string; participantIdentity: string; hostUserId: string }) {
  const entry = await findWaitingEntry(options.roomId, options.participantIdentity);
  if (!entry || entry.status !== "pending") {
    return null;
  }

  const [updated] = await db
    .update(schema.roomWaitingEntries)
    .set({
      status: "admitted",
      resolvedAt: new Date(),
      resolvedById: options.hostUserId,
    })
    .where(eq(schema.roomWaitingEntries.id, entry.id))
    .returning();

  return updated;
}

export async function denyWaitingEntry(options: { roomId: string; participantIdentity: string; hostUserId: string }) {
  const entry = await findWaitingEntry(options.roomId, options.participantIdentity);
  if (!entry || entry.status !== "pending") {
    return null;
  }

  const [updated] = await db
    .update(schema.roomWaitingEntries)
    .set({
      status: "denied",
      resolvedAt: new Date(),
      resolvedById: options.hostUserId,
    })
    .where(eq(schema.roomWaitingEntries.id, entry.id))
    .returning();

  return updated;
}
