export type TreeId = "pocket-dimension" | "zeo" | "chhan-chhan";

export type LayoutTreeData = {
  trees: TreeId[];
  tree: TreeId | null;
  bmadRootError: string | null;
};
