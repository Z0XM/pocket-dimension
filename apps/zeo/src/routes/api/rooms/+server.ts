import { json, error } from "@sveltejs/kit";
import { canCreateRoom, requireContributorOrAdmin } from "$lib/server/authz";
import { readJsonBody } from "$lib/server/http";
import { countOccupyingRooms, createRoom, getRoomLimits } from "$lib/server/rooms";
import { createRoomSchema } from "$lib/validation/rooms";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) => {
  const [activeRoomCount, limits] = await Promise.all([countOccupyingRooms(), getRoomLimits()]);

  return json({
    activeRoomCount,
    maxConcurrentRooms: limits.maxConcurrentRooms,
    canCreate: locals.user ? canCreateRoom(locals.user.role) : false,
  });
};

export const POST: RequestHandler = async ({ locals, request }) => {
  const user = requireContributorOrAdmin(locals);
  const { displayName, waitingRoomEnabled, isPublic, isPerpetual, scheduledStartAt } = await readJsonBody(request, createRoomSchema);

  const result = await createRoom({
    displayName,
    hostUserId: user.id,
    waitingRoomEnabled,
    isPublic,
    isPerpetual,
    scheduledStartAt: scheduledStartAt ? new Date(scheduledStartAt) : undefined,
  });

  if ("error" in result) {
    if (result.error === "capacity") {
      throw error(409, "All rooms are in use. Try again when a call ends.");
    }
    if (result.error === "scheduling_disabled") {
      throw error(403, "Scheduled rooms are disabled by the operator");
    }
    if (result.error === "invalid_schedule") {
      throw error(400, "Scheduled start time must be in the future");
    }
    if (result.error === "invalid_perpetual_schedule") {
      throw error(400, "Perpetual rooms cannot be scheduled for later");
    }
  }

  return json(
    {
      room: {
        slug: result.room.slug,
        displayName: result.room.displayName,
        status: result.room.status,
        waitingRoomEnabled: result.room.waitingRoomEnabled,
        isPublic: result.room.isPublic,
        isPerpetual: result.room.isPerpetual,
        scheduledStartAt: result.room.scheduledStartAt?.toISOString() ?? null,
      },
    },
    { status: 201 }
  );
};
