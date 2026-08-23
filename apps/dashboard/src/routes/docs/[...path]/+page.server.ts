import { decodePathParam } from "$lib/docs-path";
import { loadArtifact } from "$lib/server/read-artifact";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, parent }) => {
  const parentData = await parent();
  const tree = parentData.tree;
  const sourcePath = decodePathParam(params.path);

  if (!tree) {
    return {
      artifact: {
        kind: "error" as const,
        sourcePath,
        reason: "No tree selected.",
      },
    };
  }

  const artifact = loadArtifact(tree, sourcePath);

  return { artifact };
};
