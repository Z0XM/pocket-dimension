import { error } from "@sveltejs/kit";
import { db, schema } from "@pocket-dimension/db";
import { eq } from "drizzle-orm";
import { findRoomBySlug, isRoomFull, MAX_PARTICIPANTS_PER_ROOM, resolveParticipantCount } from "$lib/server/rooms";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, locals }) => {
  const slug = params.slug;
  const room = await findRoomBySlug(slug);

  if (!room) {
    error(404, "Room not found");
  }

  const host = await db.query.user.findFirst({
    where: eq(schema.user.id, room.hostUserId),
  });

  const participantCount = room.status === "ended" ? 0 : await resolveParticipantCount(room);

  return {
    slug,
    room: {
      displayName: room.displayName,
      status: room.status,
      hostUserId: room.hostUserId,
      waitingRoomEnabled: room.waitingRoomEnabled,
    },
    hostName: host?.username ?? host?.email?.split("@")[0] ?? "Host",
    participantCount,
    maxParticipants: MAX_PARTICIPANTS_PER_ROOM,
    isFull: isRoomFull(participantCount),
    isEnded: room.status === "ended",
    isHost: locals.user?.id === room.hostUserId,
    user: locals.user
      ? {
          id: locals.user.id,
          email: locals.user.email,
          username: locals.user.username,
        }
      : null,
  };
};
