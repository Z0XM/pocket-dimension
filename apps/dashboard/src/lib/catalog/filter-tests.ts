import type { TestCatalogEntry, TreeId } from "$lib/types";

/** Pure tree join filter for on-disk test catalog rows (not a BMAD scan). */
export function filterTestsForTree(tests: TestCatalogEntry[], tree: TreeId | null): TestCatalogEntry[] {
  if (!tree) {
    return [];
  }

  if (tree === "pocket-dimension") {
    return tests;
  }

  if (tree === "zeo") {
    return tests.filter((entry) => entry.treeHint === "zeo" || entry.sourcePath.startsWith("apps/zeo/"));
  }

  if (tree === "chhan-chhan") {
    return tests.filter((entry) => entry.treeHint === "chhan-chhan" || entry.sourcePath.startsWith("apps/chhan-chhan/"));
  }

  return [];
}
