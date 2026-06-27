import { db, schema } from "@pocket-dimension/db";
import { and, eq, isNull } from "drizzle-orm";
import { decrementLiveParticipantCount, incrementLiveParticipantCount } from "./room-occupancy";

export async function findRoomBySlug(slug: string) {
  return db.query.rooms.findFirst({
    where: eq(schema.rooms.slug, slug),
  });
}

export async function findRoomByLiveKitName(livekitRoomName: string) {
  return db.query.rooms.findFirst({
    where: eq(schema.rooms.livekitRoomName, livekitRoomName),
  });
}

export async function recordParticipantJoined(options: { roomId: string; identity: string; displayName?: string }) {
  const isGuest = options.identity.startsWith("guest_");
  const existing = await db.query.roomParticipants.findFirst({
    where: and(
      eq(schema.roomParticipants.roomId, options.roomId),
      eq(schema.roomParticipants.participantIdentity, options.identity),
      isNull(schema.roomParticipants.leftAt)
    ),
  });

  if (!existing) {
    await db.insert(schema.roomParticipants).values({
      roomId: options.roomId,
      participantIdentity: options.identity,
      userId: isGuest ? null : options.identity,
      guestDisplayName: isGuest ? (options.displayName ?? options.identity) : null,
      isGuest,
    });
    incrementLiveParticipantCount(options.roomId);
    return;
  }

  incrementLiveParticipantCount(options.roomId);
}

export async function recordParticipantLeft(options: { roomId: string; identity: string }) {
  const openRow = await db.query.roomParticipants.findFirst({
    where: and(
      eq(schema.roomParticipants.roomId, options.roomId),
      eq(schema.roomParticipants.participantIdentity, options.identity),
      isNull(schema.roomParticipants.leftAt)
    ),
    orderBy: (table, { desc }) => [desc(table.joinedAt)],
  });

  if (openRow) {
    await db.update(schema.roomParticipants).set({ leftAt: new Date() }).where(eq(schema.roomParticipants.id, openRow.id));
  }

  decrementLiveParticipantCount(options.roomId);
}

export async function countActiveParticipantsFromDb(roomId: string) {
  const rows = await db.query.roomParticipants.findMany({
    where: and(eq(schema.roomParticipants.roomId, roomId), isNull(schema.roomParticipants.leftAt)),
  });
  return rows.length;
}
