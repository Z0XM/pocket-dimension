import { json, error } from "@sveltejs/kit";
import { displayNameForUser, requireUser } from "$lib/server/authz";
import { ROOM_EMPTY_GRACE_SECONDS } from "$lib/server/constants";
import { mintRoomJoinToken, publicLiveKitWsUrl, clientIceServers } from "$lib/server/livekit-token";
import { isParticipantBlocked } from "$lib/server/session-blocks";
import { findRoomBySlug, getRoomLimits, isRoomFullForRoom, resolveParticipantCount } from "$lib/server/rooms";
import { formatScheduledStart, isRoomJoinable } from "$lib/server/room-schedule";
import { isWaitingRoomAdmitted, requestWaitingRoomEntry } from "$lib/server/waiting-room";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals, params }) => {
  const user = requireUser(locals);

  const slug = params.slug;
  if (!slug) {
    throw error(400, "Room slug is required");
  }

  const room = await findRoomBySlug(slug);
  if (!room) {
    throw error(404, "Room not found");
  }

  if (room.status === "ended") {
    throw error(410, "This room has ended");
  }

  if (!isRoomJoinable(room, { isHost: user.id === room.hostUserId })) {
    throw error(403, room.scheduledStartAt ? `This room opens at ${formatScheduledStart(room.scheduledStartAt)}` : "This room is not open yet");
  }

  const identity = user.id;
  const name = displayNameForUser(user);
  const isHost = user.id === room.hostUserId;

  if (room.isLocked && !isHost) {
    throw error(403, "This room is locked. The host must unlock it before new participants can join.");
  }

  if (await isParticipantBlocked(room.id, identity)) {
    throw error(403, "You were removed from this call");
  }

  if (room.waitingRoomEnabled && !isHost) {
    const admitted = await isWaitingRoomAdmitted(room, identity);
    if (!admitted) {
      const waiting = await requestWaitingRoomEntry({
        roomId: room.id,
        participantIdentity: identity,
        displayName: name,
      });

      if (waiting.status === "denied") {
        throw error(403, "The host declined your request to join");
      }

      return json({
        status: "waiting",
        identity,
        displayName: name,
        waitingStatus: waiting.status,
      });
    }
  }

  const participantCount = await resolveParticipantCount(room);
  if (await isRoomFullForRoom(participantCount)) {
    throw error(409, "Room is full");
  }

  const limits = await getRoomLimits();
  const token = await mintRoomJoinToken({
    livekitRoomName: room.livekitRoomName,
    identity,
    name,
  });

  const iceServers = clientIceServers();

  return json({
    status: "ready",
    token,
    wsUrl: publicLiveKitWsUrl(),
    ...(iceServers ? { iceServers } : {}),
    roomName: room.livekitRoomName,
    identity,
    displayName: name,
    participantCount,
    maxParticipants: limits.maxParticipantsPerRoom,
    graceSeconds: ROOM_EMPTY_GRACE_SECONDS,
  });
};
