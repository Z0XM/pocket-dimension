import { json, error } from "@sveltejs/kit";
import { requireRhymesAdmin } from "$lib/server/authz";
import { listMemberships, upsertMembership, type RhymesWorkspaceRole } from "$lib/server/membership";
import type { RequestHandler } from "./$types";

const ROLES: RhymesWorkspaceRole[] = ["owner", "admin", "editor", "contributor", "viewer"];

export const GET: RequestHandler = async ({ locals }) => {
  await requireRhymesAdmin(locals);
  const memberships = await listMemberships();
  return json({ memberships });
};

export const POST: RequestHandler = async ({ locals, request }) => {
  const actor = await requireRhymesAdmin(locals);

  let payload: { userId?: unknown; role?: unknown };
  try {
    payload = await request.json();
  } catch {
    throw error(400, "Invalid JSON body");
  }

  if (typeof payload.userId !== "string" || typeof payload.role !== "string" || !ROLES.includes(payload.role as RhymesWorkspaceRole)) {
    throw error(400, "userId and valid role are required");
  }

  const membership = await upsertMembership(actor.id, payload.userId, payload.role as RhymesWorkspaceRole);
  return json({ membership });
};
