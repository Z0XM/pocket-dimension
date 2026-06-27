import { json, error } from "@sveltejs/kit";
import { stopActiveScreenShares } from "$lib/server/livekit-room";
import { findRoomBySlug } from "$lib/server/rooms";
import type { RequestHandler } from "./$types";

/** Stops any active screen share in the LiveKit room (single-sharer takeover). */
export const POST: RequestHandler = async ({ params }) => {
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

  await stopActiveScreenShares(room.livekitRoomName);

  return json({ ok: true });
};
