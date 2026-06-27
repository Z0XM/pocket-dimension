import { canCreateRoom } from "$lib/server/authz";
import { countActiveRooms, MAX_CONCURRENT_ROOMS } from "$lib/server/rooms";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  const activeRoomCount = await countActiveRooms();

  return {
    roomStats: {
      activeRoomCount,
      maxConcurrentRooms: MAX_CONCURRENT_ROOMS,
      canCreate: locals.user ? canCreateRoom(locals.user.role) : false,
    },
  };
};
