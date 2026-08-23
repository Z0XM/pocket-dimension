import type { LayoutTreeData } from "$lib/types";

/** Literal EXPERIENCE.md / UX-DR14 strings — routes must not invent soft copy. */
export const EXPERIENCE_COPY = {
  docsEmptyTree: {
    title: "No Docs in this Tree.",
    reason: "This Tree has no catalogued Artifacts on disk.",
  },
  unreadableArtifact: {
    title: "Unreadable Artifact.",
  },
  bmadRootUnavailable: {
    title: "BMAD Root unavailable.",
    reasonFallback: "No Current BMAD Trees were found on disk.",
  },
  docsSelect: {
    title: "Select an Artifact.",
    reason: "Choose a row in the Catalog.",
  },
  featuresEmpty: {
    title: "No Features in this Tree.",
    reason: "No Feature or FR sections were found in planning PRDs for this Tree.",
  },
  deliveryEmpty: {
    title: "No Epics in this Tree.",
    reason: "No Epic or Story Artifacts were found in this Tree.",
  },
} as const;

export function docsEmptyKindCopy(kindLabel: string): { title: string; reason: string } {
  return {
    title: `No ${kindLabel} in this Tree.`,
    reason: `Nothing classified as ${kindLabel} was found.`,
  };
}

/** Prefer server snapshot error when the selected tree root is unreadable. */
export function docsEmptyReason(snapshotError?: string | null): string {
  return snapshotError?.trim() || EXPERIENCE_COPY.docsEmptyTree.reason;
}

export function searchNoMatches(query: string): { title: string; reason?: string } {
  return {
    title: `No matches for ${query}.`,
  };
}

/** True when Docs should show the empty-Tree honest state (not the Select prompt). */
export function isDocsTreeEmpty(data: Pick<LayoutTreeData, "tree" | "snapshot" | "snapshotError">): boolean {
  if (!data.tree || !data.snapshot) {
    return true;
  }

  if (data.snapshotError) {
    return true;
  }

  return data.snapshot.artifacts.length === 0;
}
