import { listCurrentTrees } from "$lib/server/bmad-root";
import { loadSearchCorpus } from "$lib/server/load-search-corpus";
import { loadTreeSnapshot } from "$lib/server/read-tree";
import type { TreeId, TreeSnapshot } from "$lib/types";
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

  let snapshot: TreeSnapshot | null = null;
  let snapshotError: string | null = null;
  if (tree) {
    const result = loadTreeSnapshot(tree);
    snapshot = { tree: result.tree, artifacts: result.artifacts };
    if ("error" in result && result.error) {
      snapshotError = result.error;
    }
  }

  return {
    trees,
    tree,
    bmadRootError: bmadRootError ?? null,
    snapshot,
    snapshotError,
    searchCorpus: loadSearchCorpus(trees),
  };
};
