import { json, error } from "@sveltejs/kit";
import { displayNameForUser } from "$lib/server/authz";
import { listChatMessages, sendChatMessage } from "$lib/server/chat";
import { readJsonBody } from "$lib/server/http";
import { isParticipantBlocked } from "$lib/server/session-blocks";
import { findRoomBySlug } from "$lib/server/rooms";
import { findWaitingEntry, isWaitingRoomAdmitted } from "$lib/server/waiting-room";
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

  const { body, guestIdentity } = await readJsonBody(request, chatMessageSchema);

  let identity: string;
  let displayName: string;
  const isHost = locals.user?.id === room.hostUserId;

  if (locals.user) {
    identity = locals.user.id;
    displayName = displayNameForUser(locals.user);
  } else {
    if (!guestIdentity) {
      throw error(400, "Guest identity is required");
    }
    identity = guestIdentity;
    const waitingEntry = await findWaitingEntry(room.id, identity);
    displayName = waitingEntry?.displayName ?? "Guest";
  }

  await assertCanChat(room, identity, isHost);

  if (await isParticipantBlocked(room.id, identity)) {
    throw error(403, "You were removed from this call");
  }

  const result = await sendChatMessage({
    roomId: room.id,
    senderIdentity: identity,
    senderDisplayName: displayName,
    body,
  });

  if ("error" in result) {
    throw error(400, "Message cannot be empty");
  }

  return json(
    {
      message: {
        id: result.message.id,
        senderIdentity: result.message.senderIdentity,
        senderDisplayName: result.message.senderDisplayName,
        body: result.message.body,
        createdAt: result.message.createdAt.toISOString(),
      },
    },
    { status: 201 }
  );
};
