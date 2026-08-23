export type TreeId = "pocket-dimension" | "zeo" | "chhan-chhan";

export type ArtifactKind = "epic" | "story" | "doc" | "prd" | "ux" | "architecture" | "unclassified";

export type ArtifactRef = {
  id: string;
  title: string;
  artifactKind: ArtifactKind;
  sourcePath: string;
  error?: string;
};

export type TreeSnapshot = {
  tree: TreeId;
  artifacts: ArtifactRef[];
};

export type LayoutTreeData = {
  trees: TreeId[];
  tree: TreeId | null;
  bmadRootError: string | null;
  snapshot: TreeSnapshot | null;
};
