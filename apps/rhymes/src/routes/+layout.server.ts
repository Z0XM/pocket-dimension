import { resolveRhymesWorkspaceAccess } from "$lib/server/membership";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
  const workspace = resolveRhymesWorkspaceAccess(locals.user);

  return {
    user: locals.user
      ? {
          id: locals.user.id,
          email: locals.user.email,
          username: locals.user.username,
          emailVerified: locals.user.emailVerified,
        }
      : null,
    creatorWorkspace: workspace,
  };
};
