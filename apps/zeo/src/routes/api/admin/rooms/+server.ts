import { json } from "@sveltejs/kit";
import { listActiveRoomsForAdmin, listScheduledRooms } from "$lib/server/admin";
import { requireAdmin } from "$lib/server/authz";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, url }) => {
  requireAdmin(locals);

  const includeScheduled = url.searchParams.get("includeScheduled") === "true";
  const activeRooms = await listActiveRoomsForAdmin();
  const scheduledRooms = includeScheduled ? await listScheduledRooms({ includePast: false }) : [];

  return json({ activeRooms, scheduledRooms });
};
