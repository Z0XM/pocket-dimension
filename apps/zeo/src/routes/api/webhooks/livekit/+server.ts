import { json, error } from "@sveltejs/kit";
import { WebhookReceiver } from "livekit-server-sdk";
import { ROOM_EMPTY_GRACE_SECONDS } from "$lib/server/constants";
import { env } from "$lib/server/env";
import { getLiveParticipantCount } from "$lib/server/room-occupancy";
import { scheduleRoomEmptyGrace } from "$lib/server/room-grace";
import { findRoomByLiveKitName, markRoomStale, recordParticipantJoined, recordParticipantLeft } from "$lib/server/rooms";
import type { RequestHandler } from "./$types";

function getWebhookReceiver() {
  return new WebhookReceiver(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
}

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.text();
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    throw error(401, "Missing LiveKit authorization header");
  }

  let event;
  try {
    event = await getWebhookReceiver().receive(body, authHeader);
  } catch {
    throw error(401, "Invalid LiveKit webhook signature");
  }

  const livekitRoomName = event.room?.name;
  if (!livekitRoomName) {
    return json({ ok: true, skipped: "no_room" });
  }

  const room = await findRoomByLiveKitName(livekitRoomName);
  if (!room) {
    return json({ ok: true, skipped: "unknown_room" });
  }

  const identity = event.participant?.identity;
  if (!identity && event.event !== "room_finished") {
    return json({ ok: true, skipped: "no_participant" });
  }

  switch (event.event) {
    case "participant_joined":
      await recordParticipantJoined({
        roomId: room.id,
        identity: identity!,
        displayName: event.participant?.name,
      });
      break;
    case "participant_left":
      await recordParticipantLeft({ roomId: room.id, identity: identity! });
      if (getLiveParticipantCount(room.id) === 0 && room.status !== "ended") {
        scheduleRoomEmptyGrace(room.id, ROOM_EMPTY_GRACE_SECONDS);
      }
      break;
    case "room_finished":
      if (room.status !== "ended") {
        if (room.isPerpetual) {
          await markRoomStale(room);
        } else {
          const { endRoom } = await import("$lib/server/rooms");
          await endRoom(room, { skipLiveKit: true });
        }
      }
      break;
    default:
      break;
  }

  return json({ ok: true, event: event.event });
};
