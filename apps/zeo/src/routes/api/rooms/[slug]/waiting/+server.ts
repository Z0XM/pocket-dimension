import { json, error } from "@sveltejs/kit";
import { readJsonBody } from "$lib/server/http";
import { admitWaitingEntry, denyWaitingEntry, findWaitingEntry, listPendingWaitingEntries } from "$lib/server/waiting-room";
import { findRoomBySlug } from "$lib/server/rooms";
import { waitingActionSchema } from "$lib/validation/rooms";
import type { RequestHandler } from "./$types";

function requireHost(locals: App.Locals, room: NonNullable<Awaited<ReturnType<typeof findRoomBySlug>>>) {
  if (locals.user?.id !== room.hostUserId) {
    throw error(403, "Only the host can manage the waiting room");
  }
}

export const GET: RequestHandler = async ({ locals, params, url }) => {
  const slug = params.slug;
  if (!slug) throw error(400, "Room slug is required");

  const room = await findRoomBySlug(slug);
  if (!room) throw error(404, "Room not found");
  if (room.status === "ended") throw error(410, "This room has ended");

  const identity = url.searchParams.get("identity");

  if (identity) {
    const entry = await findWaitingEntry(room.id, identity);
    return json({
      waitingRoomEnabled: room.waitingRoomEnabled,
      status: entry?.status ?? null,
    });
  }

  requireHost(locals, room);

  const pending = await listPendingWaitingEntries(room.id);

  return json({
    waitingRoomEnabled: room.waitingRoomEnabled,
    pending: pending.map((entry) => ({
      identity: entry.participantIdentity,
      displayName: entry.displayName,
      requestedAt: entry.requestedAt.toISOString(),
    })),
  });
};

export const POST: RequestHandler = async ({ locals, params, request, url }) => {
  const slug = params.slug;
  if (!slug) throw error(400, "Room slug is required");

  const room = await findRoomBySlug(slug);
  if (!room) throw error(404, "Room not found");
  if (room.status === "ended") throw error(410, "This room has ended");

  requireHost(locals, room);

  const action = url.searchParams.get("action");
  const { identity } = await readJsonBody(request, waitingActionSchema);

  if (action === "admit") {
    const entry = await admitWaitingEntry({
      roomId: room.id,
      participantIdentity: identity,
      hostUserId: locals.user!.id,
    });
    if (!entry) throw error(404, "Waiting entry not found");
    return json({ ok: true, status: entry.status });
  }

  if (action === "deny") {
    const entry = await denyWaitingEntry({
      roomId: room.id,
      participantIdentity: identity,
      hostUserId: locals.user!.id,
    });
    if (!entry) throw error(404, "Waiting entry not found");
    return json({ ok: true, status: entry.status });
  }

  throw error(400, "Invalid action — use ?action=admit or ?action=deny");
};
