import { countOccupyingRooms, getRoomLimits } from "$lib/server/rooms";
import { isAdmin } from "$lib/server/authz";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  const [activeRoomCount, limits] = await Promise.all([countOccupyingRooms(), getRoomLimits()]);

  return {
    roomStats: {
      activeRoomCount,
      maxConcurrentRooms: limits.maxConcurrentRooms,
    },
    isAdmin: locals.user ? isAdmin(locals.user.role) : false,
  };
};
