import { error, redirect } from "@sveltejs/kit";
import { listActiveRoomsForAdmin, listScheduledRooms } from "$lib/server/admin";
import { isAdmin } from "$lib/server/authz";
import { getOperatorSettings } from "$lib/server/operator-settings";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    redirect(307, "/login?redirect=/admin");
  }

  if (!isAdmin(locals.user.role)) {
    error(403, "Admin access required");
  }

  const [settings, activeRooms, scheduledRooms] = await Promise.all([
    getOperatorSettings(true),
    listActiveRoomsForAdmin(),
    listScheduledRooms({ includePast: false }),
  ]);

  return {
    settings,
    activeRooms,
    scheduledRooms,
  };
};
