import { error, redirect } from "@sveltejs/kit";
import { resolveRhymesWorkspaceAccess, listMemberships } from "$lib/server/membership";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  const workspace = await resolveRhymesWorkspaceAccess(locals.user);
  if (!workspace.canAdmin) {
    if (!locals.user) {
      throw redirect(307, `/login?redirect=${encodeURIComponent("/admin/people")}`);
    }
    throw error(403, "Rhymes admin access required");
  }

  return {
    memberships: await listMemberships(),
  };
};
