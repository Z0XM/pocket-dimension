import { describe, expect, it } from "bun:test";
import { docsEmptyKindCopy, docsEmptyReason, EXPERIENCE_COPY, isDocsTreeEmpty } from "./experience-copy";
import type { LayoutTreeData, TreeSnapshot } from "$lib/types";

const emptySnapshot: TreeSnapshot = { tree: "pocket-dimension", artifacts: [] };

const populatedSnapshot: TreeSnapshot = {
  tree: "pocket-dimension",
  artifacts: [
    {
      id: "planning-artifacts-epics-dashboard-md",
      title: "Epics",
      artifactKind: "epic",
      sourcePath: "planning-artifacts/epics-dashboard.md",
    },
  ],
};

describe("experience-copy", () => {
  it("uses literal empty Tree title from EXPERIENCE", () => {
    expect(EXPERIENCE_COPY.docsEmptyTree.title).toBe("No Docs in this Tree.");
  });

  it("uses literal Features empty title from EXPERIENCE", () => {
    expect(EXPERIENCE_COPY.featuresEmpty.title).toBe("No Features in this Tree.");
  });

  it("uses literal Delivery empty title from EXPERIENCE", () => {
    expect(EXPERIENCE_COPY.deliveryEmpty.title).toBe("No Epics in this Tree.");
  });

  it("uses Unreadable Artifact. title exactly", () => {
    expect(EXPERIENCE_COPY.unreadableArtifact.title).toBe("Unreadable Artifact.");
  });

  it("prefers snapshotError over generic empty reason", () => {
    expect(docsEmptyReason("Tree directory missing.")).toBe("Tree directory missing.");
    expect(docsEmptyReason(null)).toBe(EXPERIENCE_COPY.docsEmptyTree.reason);
  });

  it("builds empty Kind copy with label", () => {
    expect(docsEmptyKindCopy("PRD")).toEqual({
      title: "No PRD in this Tree.",
      reason: "Nothing classified as PRD was found.",
    });
  });

  it("treats missing tree, snapshot error, and zero artifacts as empty Docs", () => {
    const base: Pick<LayoutTreeData, "tree" | "snapshot" | "snapshotError"> = {
      tree: "pocket-dimension",
      snapshot: populatedSnapshot,
      snapshotError: null,
    };

    expect(isDocsTreeEmpty(base)).toBe(false);
    expect(isDocsTreeEmpty({ ...base, tree: null })).toBe(true);
    expect(isDocsTreeEmpty({ ...base, snapshot: null })).toBe(true);
    expect(isDocsTreeEmpty({ ...base, snapshot: emptySnapshot })).toBe(true);
    expect(isDocsTreeEmpty({ ...base, snapshotError: "Could not resolve path." })).toBe(true);
  });
});
