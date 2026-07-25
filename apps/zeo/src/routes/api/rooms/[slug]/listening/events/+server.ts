import { error } from "@sveltejs/kit";
import { requireUser } from "$lib/server/authz";
import { requireRoomMember } from "$lib/server/listening/authz";
import { getRoomListeningSnapshot } from "$lib/server/listening/sessions";
import { createListeningSSEStream } from "$lib/server/listening/sse";
import { findRoomBySlug } from "$lib/server/rooms";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, params }) => {
  const user = requireUser(locals);
  const slug = params.slug;
  if (!slug) throw error(400, "Room slug is required");

  const room = await findRoomBySlug(slug);
  if (!room) throw error(404, "Room not found");

  await requireRoomMember(room, user.id);

  const snapshot = await getRoomListeningSnapshot(room.id);
  if (!snapshot?.session) {
    throw error(404, "No active listening session in this room");
  }

  const stream = createListeningSSEStream(snapshot.session.id, snapshot);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
};
