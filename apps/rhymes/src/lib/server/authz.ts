import { error } from "@sveltejs/kit";
import { hasRhymesCreateAccess } from "$lib/server/membership";

export function requireRhymesCreator(locals: App.Locals) {
  if (!locals.user?.id) {
    throw error(401, "Authentication required");
  }

  if (!hasRhymesCreateAccess(locals.user)) {
    throw error(403, "Rhymes creator access required");
  }

  return locals.user;
}
