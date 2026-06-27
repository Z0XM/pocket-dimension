import { db, schema } from "@pocket-dimension/db";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { MAX_CONCURRENT_ROOMS, MAX_PARTICIPANTS_PER_ROOM } from "./constants";
import { generateRoomSlug } from "./identity";
import { countLiveKitParticipants, deleteLiveKitRoom } from "./livekit-room";
import {
  clearLiveParticipantCount,
  decrementLiveParticipantCount,
  getLiveParticipantCount,
  incrementLiveParticipantCount,
  setLiveParticipantCount,
} from "./room-occupancy";
import { cancelRoomEmptyGrace } from "./room-grace";

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

export async function countActiveRooms() {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.rooms)
    .where(inArray(schema.rooms.status, ["waiting", "active"]));
  return rows[0]?.count ?? 0;
}

export async function createRoom(options: { displayName: string; hostUserId: string; waitingRoomEnabled?: boolean }) {
  const activeCount = await countActiveRooms();
  if (activeCount >= MAX_CONCURRENT_ROOMS) {
    return { error: "capacity" as const };
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = generateRoomSlug();
    const livekitRoomName = crypto.randomUUID();

    try {
      const [room] = await db
        .insert(schema.rooms)
        .values({
          slug,
          livekitRoomName,
          displayName: options.displayName,
          hostUserId: options.hostUserId,
          status: "waiting",
          waitingRoomEnabled: options.waitingRoomEnabled ?? false,
          createdById: options.hostUserId,
          updatedById: options.hostUserId,
        })
        .returning();

      return { room };
    } catch {
      // slug collision — retry
    }
  }

  throw new Error("Failed to generate unique room slug");
}

export async function resolveParticipantCount(room: typeof schema.rooms.$inferSelect) {
  const memoryCount = getLiveParticipantCount(room.id);

  try {
    const liveKitCount = await countLiveKitParticipants(room.livekitRoomName);
    const count = Math.max(memoryCount, liveKitCount);
    setLiveParticipantCount(room.id, count);
    return count;
  } catch {
    const dbCount = await countActiveParticipantsFromDb(room.id);
    return Math.max(memoryCount, dbCount);
  }
}

export async function listOpenParticipants(roomId: string) {
  return db.query.roomParticipants.findMany({
    where: and(eq(schema.roomParticipants.roomId, roomId), isNull(schema.roomParticipants.leftAt)),
    orderBy: (table, { asc }) => [asc(table.joinedAt)],
  });
}

export async function markRoomActive(roomId: string) {
  await db
    .update(schema.rooms)
    .set({ status: "active", updatedAt: new Date() })
    .where(and(eq(schema.rooms.id, roomId), eq(schema.rooms.status, "waiting")));
}

export async function endRoom(room: typeof schema.rooms.$inferSelect, options?: { skipLiveKit?: boolean }) {
  if (room.status === "ended") {
    return;
  }

  cancelRoomEmptyGrace(room.id);

  await db
    .update(schema.rooms)
    .set({
      status: "ended",
      endedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.rooms.id, room.id));

  clearLiveParticipantCount(room.id);

  if (!options?.skipLiveKit) {
    try {
      await deleteLiveKitRoom(room.livekitRoomName);
    } catch {
      // Room may not exist on LiveKit yet
    }
  }
}

export async function endRoomById(roomId: string, options?: { reason?: string; skipLiveKit?: boolean }) {
  const room = await db.query.rooms.findFirst({
    where: eq(schema.rooms.id, roomId),
  });
  if (!room || room.status === "ended") {
    return null;
  }

  if (options?.reason === "empty") {
    const openCount = await resolveParticipantCount(room);
    if (openCount > 0) {
      return room;
    }
  }

  await endRoom(room, options);
  return room;
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

  cancelRoomEmptyGrace(options.roomId);
  await markRoomActive(options.roomId);

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

export async function markParticipantRemoved(options: { roomId: string; identity: string; removedById: string }) {
  const openRow = await db.query.roomParticipants.findFirst({
    where: and(
      eq(schema.roomParticipants.roomId, options.roomId),
      eq(schema.roomParticipants.participantIdentity, options.identity),
      isNull(schema.roomParticipants.leftAt)
    ),
  });

  if (openRow) {
    await db
      .update(schema.roomParticipants)
      .set({ leftAt: new Date(), removedById: options.removedById })
      .where(eq(schema.roomParticipants.id, openRow.id));
  }

  decrementLiveParticipantCount(options.roomId);
}

export async function countActiveParticipantsFromDb(roomId: string) {
  const rows = await db.query.roomParticipants.findMany({
    where: and(eq(schema.roomParticipants.roomId, roomId), isNull(schema.roomParticipants.leftAt)),
  });
  return rows.length;
}

export function isRoomFull(participantCount: number) {
  return participantCount >= MAX_PARTICIPANTS_PER_ROOM;
}

export { MAX_CONCURRENT_ROOMS, MAX_PARTICIPANTS_PER_ROOM };
