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
  snapshotError?: string | null;
};

export type ArtifactSibling = {
  title: string;
  sourcePath: string;
};

export type ArtifactPrimary = {
  title: string;
  sourcePath: string;
  html: string;
};

export type ArtifactPageData =
  | { kind: "markdown"; title: string; sourcePath: string; html: string }
  | {
      kind: "run-folder";
      title: string;
      sourcePath: string;
      primary?: ArtifactPrimary;
      siblings: ArtifactSibling[];
    }
  | { kind: "text"; title: string; sourcePath: string; text: string }
  | { kind: "error"; title?: string; sourcePath: string; reason: string };
