export type TreeId = "pocket-dimension" | "zeo" | "chhan-chhan";

export type ArtifactKind = "epic" | "story" | "doc" | "prd" | "ux" | "architecture" | "unclassified";

export type StoryStatus = "backlog" | "in-progress" | "done" | "unknown";

export type { DeliveryItem, DeliveryView } from "$lib/catalog/delivery";

export type ArtifactRef = {
  id: string;
  title: string;
  artifactKind: ArtifactKind;
  sourcePath: string;
  status?: StoryStatus;
  statusLabel?: string;
  error?: string;
};

export type TreeSnapshot = {
  tree: TreeId;
  artifacts: ArtifactRef[];
};

export type SearchHitKind = "feature" | "epic" | "story" | "test" | "docs";

/** Preloaded text document for in-memory search (layout payload). */
export type SearchCorpusEntry = {
  kind: SearchHitKind;
  id: string;
  title: string;
  tree: TreeId;
  text: string;
  href: string;
};

/** Result row after query — architecture hit shape. */
export type SearchHit = {
  kind: SearchHitKind;
  id: string;
  title: string;
  snippet: string;
  href: string;
  tree: TreeId;
};

/** One on-disk test file from apps/** (layout `tests` field). */
export type TestCatalogEntry = {
  id: string;
  name: string;
  sourcePath: string;
  treeHint: TreeId | null;
  relatedStoryHref?: string | null;
  href: string;
};

export type LayoutTreeData = {
  trees: TreeId[];
  tree: TreeId | null;
  bmadRootError: string | null;
  snapshot: TreeSnapshot | null;
  snapshotError?: string | null;
  searchCorpus: SearchCorpusEntry[];
  tests: TestCatalogEntry[];
};

export type FeatureRow = {
  id: string;
  name: string;
  sourcePath: string;
  sourceTitle: string;
  headingSlug: string;
  kind: "fr" | "feature";
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
