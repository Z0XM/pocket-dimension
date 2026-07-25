import { error, json } from "@sveltejs/kit";
import { requireUser } from "$lib/server/authz";
import { requireRoomMember } from "$lib/server/listening/authz";
import {
  canEndListeningSession,
  endListeningSession,
  findActiveListeningSession,
  getRoomListeningSnapshot,
  startListeningSession,
} from "$lib/server/listening/sessions";
import { emptyListeningSnapshot } from "$lib/server/listening/snapshot";
import { findRoomBySlug } from "$lib/server/rooms";
import type { RequestHandler } from "./$types";

async function loadRoom(slug: string | undefined) {
  if (!slug) throw error(400, "Room slug is required");
  const room = await findRoomBySlug(slug);
  if (!room) throw error(404, "Room not found");
  return room;
}

function handleListeningError(cause: unknown): never {
  if (cause && typeof cause === "object" && "code" in cause) {
    if (cause.code === "youtube_link_required") throw error(403, "Connect YouTube before starting Shared Listening");
    if (cause.code === "active_listening_exists") throw error(409, "Shared Listening is already active in this room");
  }
  throw cause;
}

export const GET: RequestHandler = async ({ locals, params }) => {
  const user = requireUser(locals);
  const room = await loadRoom(params.slug);
  await requireRoomMember(room, user.id);

  const snapshot = await getRoomListeningSnapshot(room.id);
  if (!snapshot?.session) {
    throw error(404, "No active listening session in this room");
  }

  return json(snapshot);
};

export const POST: RequestHandler = async ({ locals, params }) => {
  const user = requireUser(locals);
  const room = await loadRoom(params.slug);
  await requireRoomMember(room, user.id);

  try {
    return json(await startListeningSession({ roomId: room.id, userId: user.id }));
  } catch (cause) {
    handleListeningError(cause);
  }
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
  const user = requireUser(locals);
  const room = await loadRoom(params.slug);
  await requireRoomMember(room, user.id);

  const session = await findActiveListeningSession(room.id);
  if (!session) {
    throw error(404, "No active listening session in this room");
  }
  if (!canEndListeningSession(session, room, user.id)) {
    throw error(403, "Only the host, linker, or DJ can end Shared Listening");
  }

  const snapshot = await endListeningSession({ roomId: room.id, sessionId: session.id });
  return json(snapshot ?? emptyListeningSnapshot());
};
