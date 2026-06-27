import { db, schema } from "@pocket-dimension/db";
import { and, desc, eq, gt, inArray, isNotNull, isNull, lte, or } from "drizzle-orm";
import { endRoom, findRoomBySlug, resolveParticipantCount } from "./rooms";
import { isRoomScheduledForFuture } from "./room-schedule";

export async function listActiveRoomsForAdmin() {
  const now = new Date();
  const rows = await db.query.rooms.findMany({
    where: and(
      inArray(schema.rooms.status, ["waiting", "active"]),
      or(isNull(schema.rooms.scheduledStartAt), lte(schema.rooms.scheduledStartAt, now))
    ),
    orderBy: [desc(schema.rooms.createdAt)],
  });

  const hostIds = [...new Set(rows.map((room) => room.hostUserId))];
  const hosts =
    hostIds.length > 0
      ? await db.query.user.findMany({
          where: inArray(schema.user.id, hostIds),
        })
      : [];
  const hostNames = new Map(hosts.map((host) => [host.id, host.username ?? host.email]));

  return Promise.all(
    rows.map(async (room) => ({
      slug: room.slug,
      displayName: room.displayName,
      status: room.status,
      hostName: hostNames.get(room.hostUserId) ?? "Unknown",
      hostUserId: room.hostUserId,
      participantCount: await resolveParticipantCount(room),
      waitingRoomEnabled: room.waitingRoomEnabled,
      scheduledStartAt: room.scheduledStartAt?.toISOString() ?? null,
      createdAt: room.createdAt.toISOString(),
    }))
  );
}

export async function listScheduledRooms(options?: { hostUserId?: string; includePast?: boolean }) {
  const now = new Date();
  const rows = await db.query.rooms.findMany({
    where: and(
      inArray(schema.rooms.status, ["waiting", "active"]),
      isNotNull(schema.rooms.scheduledStartAt),
      options?.hostUserId ? eq(schema.rooms.hostUserId, options.hostUserId) : undefined,
      options?.includePast ? undefined : gt(schema.rooms.scheduledStartAt, now)
    ),
    orderBy: (table, { asc }) => [asc(table.scheduledStartAt)],
  });

  return rows.map((room) => ({
    slug: room.slug,
    displayName: room.displayName,
    scheduledStartAt: room.scheduledStartAt!.toISOString(),
    waitingRoomEnabled: room.waitingRoomEnabled,
    isFuture: isRoomScheduledForFuture(room),
  }));
}

export async function forceEndRoomBySlug(slug: string, adminUserId: string) {
  const room = await findRoomBySlug(slug);
  if (!room || room.status === "ended") {
    return null;
  }

  await endRoom(room, { forceEndedById: adminUserId, updatedById: adminUserId });
  return room;
}
