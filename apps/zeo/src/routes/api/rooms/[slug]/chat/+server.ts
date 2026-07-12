import { json, error } from "@sveltejs/kit";
import { displayNameForUser, requireUser } from "$lib/server/authz";
import { listChatMessages, sendChatMessage } from "$lib/server/chat";
import { readJsonBody } from "$lib/server/http";
import { isParticipantBlocked } from "$lib/server/session-blocks";
import { getOperatorSettings } from "$lib/server/operator-settings";
import { findRoomBySlug } from "$lib/server/rooms";
import { isWaitingRoomAdmitted } from "$lib/server/waiting-room";
import { chatMessageSchema } from "$lib/validation/rooms";
import type { RequestHandler } from "./$types";

async function assertCanChat(room: NonNullable<Awaited<ReturnType<typeof findRoomBySlug>>>, identity: string, isHost: boolean) {
  if (isHost || (await isWaitingRoomAdmitted(room, identity))) {
    return;
  }
  throw error(403, "Not admitted to this room");
}

export const GET: RequestHandler = async ({ params, url }) => {
  const slug = params.slug;
  if (!slug) throw error(400, "Room slug is required");

  const room = await findRoomBySlug(slug);
  if (!room) throw error(404, "Room not found");
  if (room.status === "ended") throw error(410, "This room has ended");
  if (room.status === "stale") throw error(409, "This room is idle. Join the call to start chatting.");

  const settings = await getOperatorSettings();
  if (!settings.chatEnabled) throw error(403, "Chat is disabled by the operator");

  const sinceParam = url.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : undefined;
  if (since && Number.isNaN(since.getTime())) {
    throw error(400, "Invalid since timestamp");
  }

  const messages = await listChatMessages({ roomId: room.id, after: since });

  return json({
    messages: messages.map((message) => ({
      id: message.id,
      senderIdentity: message.senderIdentity,
      senderDisplayName: message.senderDisplayName,
      kind: message.kind,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    })),
  });
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const slug = params.slug;
  if (!slug) throw error(400, "Room slug is required");

  const room = await findRoomBySlug(slug);
  if (!room) throw error(404, "Room not found");
  if (room.status === "ended") throw error(410, "This room has ended");
  if (room.status === "stale") throw error(409, "This room is idle. Join the call to start chatting.");

  const settings = await getOperatorSettings();
  if (!settings.chatEnabled) throw error(403, "Chat is disabled by the operator");

  const user = requireUser(locals);
  const { body, kind } = await readJsonBody(request, chatMessageSchema);

  const identity = user.id;
  const displayName = displayNameForUser(user);
  const isHost = user.id === room.hostUserId;

  await assertCanChat(room, identity, isHost);

  if (await isParticipantBlocked(room.id, identity)) {
    throw error(403, "You were removed from this call");
  }

  const result = await sendChatMessage({
    roomId: room.id,
    senderIdentity: identity,
    senderDisplayName: displayName,
    body,
    kind,
  });

  if ("error" in result) {
    if (result.error === "invalid_snapshot") {
      throw error(400, "Invalid snapshot image");
    }
    throw error(400, "Message cannot be empty");
  }

  return json(
    {
      message: {
        id: result.message.id,
        senderIdentity: result.message.senderIdentity,
        senderDisplayName: result.message.senderDisplayName,
        kind: result.message.kind,
        body: result.message.body,
        createdAt: result.message.createdAt.toISOString(),
      },
    },
    { status: 201 }
  );
};
