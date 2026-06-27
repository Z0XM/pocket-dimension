import { countOccupyingRooms, getRoomLimits } from "$lib/server/rooms";
import { listScheduledRooms } from "$lib/server/admin";
import { isAdmin } from "$lib/server/authz";
import { getOperatorSettings } from "$lib/server/operator-settings";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  const [activeRoomCount, limits, settings] = await Promise.all([countOccupyingRooms(), getRoomLimits(), getOperatorSettings()]);

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
  };
};
