import { json, error } from "@sveltejs/kit";
import { db, schema } from "@pocket-dimension/db";
import { inArray } from "drizzle-orm";
import {
  findRoomBySlug,
  getRoomLimits,
  isRoomFullForRoom,
  listOpenParticipants,
  resolveParticipantCount,
  updateRoomLock,
  updateRoomVisibility,
} from "$lib/server/rooms";
import { formatScheduledStart, isRoomJoinable, isRoomScheduledForFuture } from "$lib/server/room-schedule";
import { readJsonBody } from "$lib/server/http";
import { updateRoomSchema } from "$lib/validation/rooms";
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

  const limits = await getRoomLimits();
  const participantCount = room.status === "ended" ? 0 : await resolveParticipantCount(room);
  const isHost = locals.user?.id === room.hostUserId;
  const scheduledForFuture = isRoomScheduledForFuture(room);

  const payload: Record<string, unknown> = {
    slug: room.slug,
    displayName: room.displayName,
    status: room.status,
    waitingRoomEnabled: room.waitingRoomEnabled,
    isPublic: room.isPublic,
    isLocked: room.isLocked,
    isPerpetual: room.isPerpetual,
    hostUserId: room.hostUserId,
    participantCount,
    maxParticipants: limits.maxParticipantsPerRoom,
    isFull: await isRoomFullForRoom(participantCount),
    isEnded: room.status === "ended",
    isHost,
    isJoinable: isRoomJoinable(room, { isHost }),
    scheduledStartAt: room.scheduledStartAt?.toISOString() ?? null,
    isScheduledForFuture: scheduledForFuture,
    scheduledStartLabel: room.scheduledStartAt ? formatScheduledStart(room.scheduledStartAt) : null,
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

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
  const slug = params.slug;
  if (!slug) {
    throw error(400, "Room slug is required");
  }

  const room = await findRoomBySlug(slug);
  if (!room) {
    throw error(404, "Room not found");
  }

  if (room.status === "ended") {
    throw error(409, "This room has ended");
  }

  const user = locals.user;
  if (!user || user.id !== room.hostUserId) {
    throw error(403, "Only the room host can update room settings");
  }

  const body = await readJsonBody(request, updateRoomSchema);
  const updates: Record<string, unknown> = {};

  if (body.isPublic !== undefined) {
    const updated = await updateRoomVisibility(room.id, body.isPublic, user.id);
    updates.isPublic = updated!.isPublic;
  }

  if (body.isLocked !== undefined) {
    const updated = await updateRoomLock(room.id, body.isLocked, user.id);
    updates.isLocked = updated!.isLocked;
  }

  return json({
    slug: room.slug,
    ...updates,
  });
};
