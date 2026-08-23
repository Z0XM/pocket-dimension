import { loadArtifactBySlug } from "$lib/server/load-by-slug";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, parent }) => {
  const parentData = await parent();
  const tree = parentData.tree;
  const id = params.id;

  if (!tree) {
    return {
      artifact: {
        kind: "error" as const,
        sourcePath: id,
        reason: "No tree selected.",
      },
      statusLabel: undefined as string | undefined,
    };
  }

  const result = loadArtifactBySlug(tree, id, "story");
  if (!result.ok) {
    return {
      artifact: {
        kind: "error" as const,
        sourcePath: result.sourcePath,
        reason: result.reason,
      },
      statusLabel: undefined as string | undefined,
    };
  }

  return {
    artifact: result.artifact,
    statusLabel: result.ref.statusLabel,
  };
};
