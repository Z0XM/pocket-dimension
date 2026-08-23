import { listCurrentTrees } from "$lib/server/bmad-root";
import type { TreeId } from "$lib/types";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ url }) => {
  const { trees, bmadRootError } = listCurrentTrees();

  const requested = url.searchParams.get("tree");
  let tree: TreeId | null = null;

  if (requested && trees.includes(requested as TreeId)) {
    tree = requested as TreeId;
  } else if (trees.length > 0) {
    tree = trees[0] ?? null;
  }

  return {
    trees,
    tree,
    bmadRootError: bmadRootError ?? null,
  };
};
