import { json } from "@sveltejs/kit";
import { requireAdmin } from "$lib/server/authz";
import { readJsonBody } from "$lib/server/http";
import { getOperatorSettings, updateOperatorSettings } from "$lib/server/operator-settings";
import { operatorSettingsSchema } from "$lib/validation/rooms";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) => {
  requireAdmin(locals);
  const settings = await getOperatorSettings(true);
  return json({ settings });
};

export const PATCH: RequestHandler = async ({ locals, request }) => {
  const admin = requireAdmin(locals);
  const body = await readJsonBody(request, operatorSettingsSchema);

  const updated = await updateOperatorSettings({
    ...body,
    updatedById: admin.id,
  });

  return json({
    settings: {
      maxConcurrentRooms: updated.maxConcurrentRooms,
      maxParticipantsPerRoom: updated.maxParticipantsPerRoom,
      chatEnabled: updated.chatEnabled,
      waitingRoomDefaultEnabled: updated.waitingRoomDefaultEnabled,
      scheduledRoomsEnabled: updated.scheduledRoomsEnabled,
    },
  });
};
