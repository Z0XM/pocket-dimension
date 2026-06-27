import { json, error } from "@sveltejs/kit";
import { db, schema } from "@pocket-dimension/db";
import { inArray } from "drizzle-orm";
import { findRoomBySlug, isRoomFull, listOpenParticipants, MAX_PARTICIPANTS_PER_ROOM, resolveParticipantCount } from "$lib/server/rooms";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, params }) => {
  const slug = params.slug;
  if (!slug) {
    throw error(400, "Room slug is required");
  }

  const room = await findRoomBySlug(slug);
  if (!room) {
    throw error(404, "Room not found");
  }

  const participantCount = room.status === "ended" ? 0 : await resolveParticipantCount(room);
  const isHost = locals.user?.id === room.hostUserId;

  const payload: Record<string, unknown> = {
    slug: room.slug,
    displayName: room.displayName,
    status: room.status,
    hostUserId: room.hostUserId,
    participantCount,
    maxParticipants: MAX_PARTICIPANTS_PER_ROOM,
    isFull: isRoomFull(participantCount),
    isEnded: room.status === "ended",
    isHost,
  };

  if (isHost && room.status !== "ended") {
    const rows = await listOpenParticipants(room.id);
    const userIds = rows.map((row) => row.userId).filter((id): id is string => Boolean(id));
    const users =
      userIds.length > 0
        ? await db.query.user.findMany({
            where: inArray(schema.user.id, userIds),
          })
        : [];
    const userNames = new Map(users.map((user) => [user.id, user.username ?? user.email]));

    payload.participants = rows.map((row) => ({
      identity: row.participantIdentity,
      displayName: row.isGuest ? row.guestDisplayName : (userNames.get(row.userId!) ?? "Member"),
      isGuest: row.isGuest,
    }));
  }

  return json(payload);
};
