import { json, error } from "@sveltejs/kit";
import { forceEndRoomBySlug } from "$lib/server/admin";
import { requireAdmin } from "$lib/server/authz";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals, params }) => {
  const admin = requireAdmin(locals);
  const slug = params.slug;

  if (!slug) {
    throw error(400, "Room slug is required");
  }

  const room = await forceEndRoomBySlug(slug, admin.id);
  if (!room) {
    throw error(404, "Active room not found");
  }

  return json({ ok: true, slug: room.slug, status: "ended" });
};
