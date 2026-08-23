import type { ArtifactKind, ArtifactRef } from "$lib/types";

export type KindGroup = {
  kind: ArtifactKind;
  label: string;
  items: ArtifactRef[];
};

const KIND_ORDER: ArtifactKind[] = ["epic", "story", "prd", "ux", "architecture", "doc", "unclassified"];

const KIND_LABELS: Record<ArtifactKind, string> = {
  epic: "Epic",
  story: "Story",
  prd: "PRD",
  ux: "UX",
  architecture: "Architecture",
  doc: "Doc",
  unclassified: "Unclassified",
};

/** Group artifacts by Kind; omit empty groups; preserve stable display order. */
export function groupArtifactsByKind(artifacts: ArtifactRef[]): KindGroup[] {
  const buckets = new Map<ArtifactKind, ArtifactRef[]>();

  for (const artifact of artifacts) {
    const list = buckets.get(artifact.artifactKind) ?? [];
    list.push(artifact);
    buckets.set(artifact.artifactKind, list);
  }

  return KIND_ORDER.filter((kind) => (buckets.get(kind)?.length ?? 0) > 0).map((kind) => ({
    kind,
    label: KIND_LABELS[kind],
    items: sortByPath(buckets.get(kind)!),
  }));
}

function sortByPath(items: ArtifactRef[]): ArtifactRef[] {
  return [...items].sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
}
