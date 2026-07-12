import { error, redirect } from "@sveltejs/kit";
import { db, schema } from "@pocket-dimension/db";
import { eq } from "drizzle-orm";
import { findRoomBySlug, getRoomLimits, isRoomFullForRoom, resolveParticipantCount } from "$lib/server/rooms";
import { formatScheduledStart, isRoomJoinable, isRoomScheduledForFuture } from "$lib/server/room-schedule";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, locals, url }) => {
  const slug = params.slug;

  if (!locals.user) {
    redirect(303, `/login?redirect=${encodeURIComponent(url.pathname)}`);
  }

  const room = await findRoomBySlug(slug);

  if (!room) {
    error(404, "Room not found");
  }

  const host = await db.query.user.findFirst({
    where: eq(schema.user.id, room.hostUserId),
  });

  const limits = await getRoomLimits();
  const participantCount = room.status === "ended" ? 0 : await resolveParticipantCount(room);
  const scheduledForFuture = isRoomScheduledForFuture(room);

  return {
    slug,
    room: {
      displayName: room.displayName,
      status: room.status,
      hostUserId: room.hostUserId,
      waitingRoomEnabled: room.waitingRoomEnabled,
      isPublic: room.isPublic,
      isLocked: room.isLocked,
      isPerpetual: room.isPerpetual,
      scheduledStartAt: room.scheduledStartAt?.toISOString() ?? null,
    },
    hostName: host?.username ?? host?.email?.split("@")[0] ?? "Host",
    participantCount,
    maxParticipants: limits.maxParticipantsPerRoom,
    chatEnabled: limits.chatEnabled,
    isFull: await isRoomFullForRoom(participantCount),
    isEnded: room.status === "ended",
    isStale: room.status === "stale",
    isJoinable: isRoomJoinable(room, { isHost: locals.user?.id === room.hostUserId }),
    isScheduledForFuture: scheduledForFuture,
    scheduledStartLabel: room.scheduledStartAt ? formatScheduledStart(room.scheduledStartAt) : null,
    isHost: locals.user.id === room.hostUserId,
    user: {
      id: locals.user.id,
      email: locals.user.email,
      username: locals.user.username,
    },
  };
};
