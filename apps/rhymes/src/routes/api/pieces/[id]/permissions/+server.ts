import { json, error } from "@sveltejs/kit";
import { grantPieceEditAccess, requirePieceEditor, revokePieceEditAccess } from "$lib/server/authz";
import { logPieceEvent } from "$lib/server/events";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const user = await requirePieceEditor(locals, params.id);

  let payload: { userId?: unknown; action?: unknown };
  try {
    payload = await request.json();
  } catch {
    throw error(400, "Invalid JSON body");
  }

  if (typeof payload.userId !== "string") {
    throw error(400, "userId is required");
  }

  if (payload.action === "revoke") {
    await revokePieceEditAccess(params.id, payload.userId);
    await logPieceEvent(params.id, user.id, "permission_revoked", { userId: payload.userId });
    return json({ message: "Edit access revoked" });
  }

  const permission = await grantPieceEditAccess(user.id, params.id, payload.userId);
  await logPieceEvent(params.id, user.id, "permission_granted", { userId: payload.userId });
  return json({ permission });
};
