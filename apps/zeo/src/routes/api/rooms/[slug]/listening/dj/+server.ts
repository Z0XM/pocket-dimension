import { error, json } from "@sveltejs/kit";
import { z } from "zod";
import { requireUser } from "$lib/server/authz";
import { readJsonBody } from "$lib/server/http";
import { requireRoomMember } from "$lib/server/listening/authz";
import { findActiveListeningSession, requireListeningDj, setListeningDj } from "$lib/server/listening/sessions";
import { findRoomBySlug } from "$lib/server/rooms";
import type { RequestHandler } from "./$types";

const setDjSchema = z.object({ userId: z.string().min(1) });

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const user = requireUser(locals);
  if (!params.slug) throw error(400, "Room slug is required");
  const room = await findRoomBySlug(params.slug);
  if (!room) throw error(404, "Room not found");
  await requireRoomMember(room, user.id);

  const session = await findActiveListeningSession(room.id);
  if (!session) throw error(404, "No active listening session in this room");

  try {
    requireListeningDj(session, room, user.id);
    const body = await readJsonBody(request, setDjSchema);
    return json(await setListeningDj({ room, sessionId: session.id, targetUserId: body.userId }));
  } catch (cause) {
    if (cause && typeof cause === "object" && "code" in cause) {
      if (cause.code === "not_listening_dj") throw error(403, "Only the DJ can hand off DJ controls");
      if (cause.code === "target_not_room_member") throw error(422, "DJ must be a current room member");
    }
    throw cause;
  }
};
