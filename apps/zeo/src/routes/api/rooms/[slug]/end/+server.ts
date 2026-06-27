import { json, error } from "@sveltejs/kit";
import { requireHost, requireUser } from "$lib/server/authz";
import { endRoom, findRoomBySlug } from "$lib/server/rooms";
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
    return json({ ok: true, status: "ended" });
  }

  requireHost(user.id, room.hostUserId);
  await endRoom(room);

  return json({ ok: true, status: "ended" });
};
