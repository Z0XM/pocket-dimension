import { error, json } from "@sveltejs/kit";
import { z } from "zod";
import { requireUser } from "$lib/server/authz";
import { requireRoomMember } from "$lib/server/listening/authz";
import { findActiveListeningSession, playListening, playListeningQueueItem, requireListeningDj } from "$lib/server/listening/sessions";
import { findRoomBySlug } from "$lib/server/rooms";
import type { RequestHandler } from "./$types";

const playBodySchema = z.object({
  itemId: z.string().min(1).optional(),
});

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const user = requireUser(locals);
  if (!params.slug) throw error(400, "Room slug is required");
  const room = await findRoomBySlug(params.slug);
  if (!room) throw error(404, "Room not found");
  await requireRoomMember(room, user.id);

  const session = await findActiveListeningSession(room.id);
  if (!session) throw error(404, "No active listening session in this room");

  let itemId: string | undefined;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw error(400, "Invalid JSON request body");
    }
    const parsed = playBodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw error(400, parsed.error.issues[0]?.message ?? "Invalid payload");
    }
    itemId = parsed.data.itemId;
  }

  try {
    requireListeningDj(session, room, user.id);
    if (itemId) {
      return json(await playListeningQueueItem(room, itemId));
    }
    return json(await playListening(room));
  } catch (cause) {
    if (cause && typeof cause === "object" && "code" in cause) {
      if (cause.code === "not_listening_dj") {
        throw error(403, "Only the DJ can control playback");
      }
      if (cause.code === "queue_item_not_found") {
        throw error(404, "Queue item not found");
      }
    }
    throw cause;
  }
};
