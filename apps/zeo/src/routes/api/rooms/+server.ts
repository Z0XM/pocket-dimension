import { json, error } from "@sveltejs/kit";
import { canCreateRoom, requireContributorOrAdmin } from "$lib/server/authz";
import { readJsonBody } from "$lib/server/http";
import { countActiveRooms, createRoom, MAX_CONCURRENT_ROOMS } from "$lib/server/rooms";
import { createRoomSchema } from "$lib/validation/rooms";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) => {
  const activeRoomCount = await countActiveRooms();

  return json({
    activeRoomCount,
    maxConcurrentRooms: MAX_CONCURRENT_ROOMS,
    canCreate: locals.user ? canCreateRoom(locals.user.role) : false,
  });
};

export const POST: RequestHandler = async ({ locals, request }) => {
  const user = requireContributorOrAdmin(locals);
  const { displayName } = await readJsonBody(request, createRoomSchema);

  const result = await createRoom({
    displayName,
    hostUserId: user.id,
  });

  if ("error" in result) {
    throw error(409, "All rooms are in use. Try again when a call ends.");
  }

  return json(
    {
      room: {
        slug: result.room.slug,
        displayName: result.room.displayName,
        status: result.room.status,
      },
    },
    { status: 201 }
  );
};
