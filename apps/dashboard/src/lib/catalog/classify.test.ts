import { describe, expect, it } from "bun:test";
import { classifyArtifact } from "./classify";
import {
  ARCHITECTURE_PATHS,
  DOC_PATHS,
  EPIC_PATHS,
  FEATURE_LIKE_PATHS,
  HEURISTIC_SNIPPETS,
  PRD_PATHS,
  STORY_PATHS,
  UNCLASSIFIED_PATHS,
  UX_PATHS,
} from "./fixtures/paths";
import type { ArtifactKind } from "$lib/types";

const ALL_KINDS: ArtifactKind[] = ["epic", "story", "doc", "prd", "ux", "architecture", "unclassified"];

describe("classifyArtifact", () => {
  it("never returns 'feature' as a Kind", () => {
    for (const path of FEATURE_LIKE_PATHS) {
      const kind = classifyArtifact(path);
      expect(kind).not.toBe("feature" as ArtifactKind);
      expect(ALL_KINDS).toContain(kind);
    }
  });

  it("classifies epic paths by filename signals", () => {
    for (const path of EPIC_PATHS) {
      expect(classifyArtifact(path)).toBe("epic");
    }
  });

  it("classifies story paths under implementation-artifacts with N-N- prefix", () => {
    for (const path of STORY_PATHS) {
      expect(classifyArtifact(path)).toBe("story");
    }
  });

  it("classifies PRD paths", () => {
    for (const path of PRD_PATHS) {
      expect(classifyArtifact(path)).toBe("prd");
    }
  });

  it("classifies UX paths", () => {
    for (const path of UX_PATHS) {
      expect(classifyArtifact(path)).toBe("ux");
    }
  });

  it("classifies architecture paths", () => {
    for (const path of ARCHITECTURE_PATHS) {
      expect(classifyArtifact(path)).toBe("architecture");
    }
  });

  it("classifies addendum and reconcile under prds as PRD (path segment wins)", () => {
    expect(classifyArtifact("planning-artifacts/prds/prd-dashboard-2026-08-23/addendum.md")).toBe("prd");
    expect(classifyArtifact("planning-artifacts/prds/prd-dashboard-2026-08-23/reconcile-prd.md")).toBe("prd");
  });

  it("classifies doc / brownfield paths", () => {
    for (const path of DOC_PATHS) {
      expect(classifyArtifact(path)).toBe("doc");
    }
  });

  it("classifies ambiguous paths as unclassified without content hint", () => {
    for (const path of UNCLASSIFIED_PATHS) {
      expect(classifyArtifact(path)).toBe("unclassified");
    }
  });

  it("path rules win over content heuristics", () => {
    expect(classifyArtifact("implementation-artifacts/2-1-browse-docs-grouped-by-artifact-kind.md", "# Epic\n")).toBe("story");
    expect(classifyArtifact("planning-artifacts/architecture.md", "# PRD\n")).toBe("architecture");
  });

  it("uses narrow content heuristics when path is unmatched", () => {
    expect(classifyArtifact("notes/unknown.md", HEURISTIC_SNIPPETS.story)).toBe("story");
    expect(classifyArtifact("notes/unknown.md", HEURISTIC_SNIPPETS.epic)).toBe("epic");
    expect(classifyArtifact("notes/unknown.md", HEURISTIC_SNIPPETS.prd)).toBe("prd");
  });

  it("classifies only-unclassified set once each as unclassified", () => {
    const kinds = UNCLASSIFIED_PATHS.map((path) => classifyArtifact(path));
    expect(new Set(kinds)).toEqual(new Set(["unclassified"]));
    expect(kinds).toHaveLength(UNCLASSIFIED_PATHS.length);
  });

  it("does not classify N-N- files outside implementation-artifacts as story", () => {
    expect(classifyArtifact("planning-artifacts/2-1-something.md")).not.toBe("story");
  });
});
