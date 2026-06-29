import { randomInt } from "node:crypto";
import { db, schema } from "@pocket-dimension/db";
import { and, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { DEFAULT_MAX_PARTICIPANTS_PER_ROOM } from "./constants";
import { generateRoomSlug } from "./identity";
import { countLiveKitParticipants, deleteLiveKitRoom } from "./livekit-room";
import { getOperatorSettings } from "./operator-settings";
import {
  clearLiveParticipantCount,
  decrementLiveParticipantCount,
  getLiveParticipantCount,
  incrementLiveParticipantCount,
  setLiveParticipantCount,
} from "./room-occupancy";
import { cancelRoomEmptyGrace } from "./room-grace";

export async function listPublicRooms() {
  const now = new Date();

  return db.query.rooms.findMany({
    where: and(
      eq(schema.rooms.isPublic, true),
      inArray(schema.rooms.status, ["waiting", "active", "stale"]),
      or(isNull(schema.rooms.scheduledStartAt), lte(schema.rooms.scheduledStartAt, now))
    ),
    orderBy: (table, { desc }) => [desc(table.updatedAt)],
    limit: 20,
  });
}

export async function updateRoomVisibility(roomId: string, isPublic: boolean, updatedById: string) {
  const [room] = await db.update(schema.rooms).set({ isPublic, updatedAt: new Date(), updatedById }).where(eq(schema.rooms.id, roomId)).returning();

  return room ?? null;
}

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

/** Rooms that consume the concurrent-room capacity (excludes future scheduled). */
export async function countOccupyingRooms() {
  const now = new Date();
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.rooms)
    .where(
      and(inArray(schema.rooms.status, ["waiting", "active"]), or(isNull(schema.rooms.scheduledStartAt), lte(schema.rooms.scheduledStartAt, now)))
    );
  return rows[0]?.count ?? 0;
}

/** @deprecated Prefer countOccupyingRooms */
export async function countActiveRooms() {
  return countOccupyingRooms();
}

export async function getRoomLimits() {
  const settings = await getOperatorSettings();
  return {
    maxConcurrentRooms: settings.maxConcurrentRooms,
    maxParticipantsPerRoom: settings.maxParticipantsPerRoom,
    chatEnabled: settings.chatEnabled,
  };
}

export async function createRoom(options: {
  displayName: string;
  hostUserId: string;
  waitingRoomEnabled?: boolean;
  isPublic?: boolean;
  isPerpetual?: boolean;
  scheduledStartAt?: Date;
}) {
  const settings = await getOperatorSettings();

  if (options.scheduledStartAt && !settings.scheduledRoomsEnabled) {
    return { error: "scheduling_disabled" as const };
  }

  if (options.scheduledStartAt && options.scheduledStartAt.getTime() <= Date.now()) {
    return { error: "invalid_schedule" as const };
  }

  const occupyingCount = await countOccupyingRooms();
  const countsTowardCap = !options.scheduledStartAt || options.scheduledStartAt.getTime() <= Date.now();

  if (countsTowardCap && occupyingCount >= settings.maxConcurrentRooms) {
    return { error: "capacity" as const };
  }

  const waitingRoomEnabled = options.waitingRoomEnabled ?? settings.waitingRoomDefaultEnabled;
  const isPublic = options.isPublic ?? false;
  const isPerpetual = options.isPerpetual ?? false;

  if (isPerpetual && options.scheduledStartAt) {
    return { error: "invalid_perpetual_schedule" as const };
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    const slug = generateRoomSlug(attempt > 0 ? { suffix: randomInt(10, 99) } : undefined);
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
          waitingRoomEnabled,
          isPublic,
          isPerpetual,
          scheduledStartAt: options.scheduledStartAt ?? null,
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
  if (room.status === "ended" || room.status === "stale") {
    return 0;
  }

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
    .where(and(eq(schema.rooms.id, roomId), inArray(schema.rooms.status, ["waiting", "stale"])));
}

export async function markRoomStale(room: typeof schema.rooms.$inferSelect) {
  if (room.status === "ended" || room.status === "stale") {
    return;
  }

  cancelRoomEmptyGrace(room.id);

  await db.update(schema.rooms).set({ status: "stale", updatedAt: new Date() }).where(eq(schema.rooms.id, room.id));

  clearLiveParticipantCount(room.id);

  try {
    await deleteLiveKitRoom(room.livekitRoomName);
  } catch {
    // LiveKit room may already be gone
  }
}

export async function endRoom(
  room: typeof schema.rooms.$inferSelect,
  options?: { skipLiveKit?: boolean; forceEndedById?: string; updatedById?: string }
) {
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
      ...(options?.forceEndedById ? { forceEndedById: options.forceEndedById } : {}),
      ...(options?.updatedById ? { updatedById: options.updatedById } : {}),
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
    if (room.isPerpetual) {
      await markRoomStale(room);
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

export function isRoomFull(participantCount: number, maxParticipants = DEFAULT_MAX_PARTICIPANTS_PER_ROOM) {
  return participantCount >= maxParticipants;
}

export async function isRoomFullForRoom(participantCount: number) {
  const { maxParticipantsPerRoom } = await getRoomLimits();
  return isRoomFull(participantCount, maxParticipantsPerRoom);
}
