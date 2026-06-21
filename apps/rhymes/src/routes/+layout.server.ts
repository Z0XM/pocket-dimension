import { resolveRhymesWorkspaceAccess } from "$lib/server/membership";
import { listCreatorPieces } from "$lib/server/pieces";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
  const workspace = await resolveRhymesWorkspaceAccess(locals.user);
  const creatorPieces =
    workspace.canCreate && locals.user?.id ? await listCreatorPieces(locals.user.id) : [];

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
    creatorPieces: creatorPieces.map((piece) => ({
      id: piece.id,
      slug: piece.slug,
      title: piece.titleText,
      status: piece.status,
      visibility: piece.visibility,
      updatedAt: piece.updatedAt.toISOString(),
    })),
  };
};
