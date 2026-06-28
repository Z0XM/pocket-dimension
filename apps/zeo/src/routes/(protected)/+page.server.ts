import { countOccupyingRooms, getRoomLimits, listPublicRooms } from "$lib/server/rooms";
import { listScheduledRooms } from "$lib/server/admin";
import { isAdmin } from "$lib/server/authz";
import { getOperatorSettings } from "$lib/server/operator-settings";
import { db, schema } from "@pocket-dimension/db";
import { eq, inArray } from "drizzle-orm";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  const [activeRoomCount, limits, settings, publicRooms] = await Promise.all([
    countOccupyingRooms(),
    getRoomLimits(),
    getOperatorSettings(),
    listPublicRooms(),
  ]);

  const hostIds = [...new Set(publicRooms.map((room) => room.hostUserId))];
  const hosts =
    hostIds.length > 0
      ? await db.query.user.findMany({
          where: inArray(schema.user.id, hostIds),
        })
      : [];
  const hostNames = new Map(hosts.map((host) => [host.id, host.username ?? host.email?.split("@")[0] ?? "Host"]));

  const scheduledRooms = locals.user && settings.scheduledRoomsEnabled ? await listScheduledRooms({ hostUserId: locals.user.id }) : [];

  return {
    roomStats: {
      activeRoomCount,
      maxConcurrentRooms: limits.maxConcurrentRooms,
      canCreate: locals.user ? locals.user.role === "contributor" || locals.user.role === "admin" : false,
    },
    isAdmin: locals.user ? isAdmin(locals.user.role) : false,
    scheduledRoomsEnabled: settings.scheduledRoomsEnabled,
    waitingRoomDefaultEnabled: settings.waitingRoomDefaultEnabled,
    scheduledRooms,
    publicRooms: publicRooms.map((room) => ({
      slug: room.slug,
      displayName: room.displayName,
      hostName: hostNames.get(room.hostUserId) ?? "Host",
      status: room.status,
    })),
  };
};
