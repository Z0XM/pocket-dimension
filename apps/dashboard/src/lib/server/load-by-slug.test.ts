import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { findArtifactBySlug, loadArtifactBySlug } from "./load-by-slug";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function createTreeFixture(): { repoRoot: string; treePath: string } {
  const repoRoot = mkdtempSync(join(tmpdir(), "load-by-slug-test-"));
  tempRoots.push(repoRoot);

  const treePath = join(repoRoot, "_bmad-output", "pocket-dimension");
  mkdirSync(join(treePath, "planning-artifacts"), { recursive: true });
  mkdirSync(join(treePath, "implementation-artifacts"), { recursive: true });

  writeFileSync(join(treePath, "planning-artifacts", "epics-dashboard.md"), "# Epics Dashboard\n\nStatus: in-progress\n");
  writeFileSync(join(treePath, "implementation-artifacts", "3-1-browse-features.md"), "# Story 3.1\n\nStatus: done\n");
  writeFileSync(join(treePath, "planning-artifacts", "architecture-dashboard.md"), "# Architecture\n");

  return { repoRoot, treePath };
}

describe("findArtifactBySlug", () => {
  it("finds epic by slug", () => {
    const { repoRoot } = createTreeFixture();
    const result = findArtifactBySlug("pocket-dimension", "planning-artifacts--epics-dashboard", "epic", repoRoot);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ref.sourcePath).toBe("planning-artifacts/epics-dashboard.md");
      expect(result.ref.statusLabel).toBe("in-progress");
    }
    void repoRoot;
  });

  it("finds story by slug with status", () => {
    const { repoRoot } = createTreeFixture();
    const result = findArtifactBySlug("pocket-dimension", "implementation-artifacts--3-1-browse-features", "story", repoRoot);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ref.sourcePath).toBe("implementation-artifacts/3-1-browse-features.md");
      expect(result.ref.statusLabel).toBe("done");
    }
    void repoRoot;
  });

  it("returns not found for missing slug", () => {
    const { repoRoot } = createTreeFixture();
    const result = findArtifactBySlug("pocket-dimension", "nope", "epic", repoRoot);
    expect(result).toEqual({ ok: false, reason: "Artifact not found." });
    void repoRoot;
  });

  it("rejects kind mismatch", () => {
    const { repoRoot } = createTreeFixture();
    const result = findArtifactBySlug("pocket-dimension", "implementation-artifacts--3-1-browse-features", "epic", repoRoot);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("Expected epic");
    }
    void repoRoot;
  });
});

describe("loadArtifactBySlug", () => {
  it("loads markdown artifact for story slug", () => {
    const { repoRoot } = createTreeFixture();
    const result = loadArtifactBySlug("pocket-dimension", "implementation-artifacts--3-1-browse-features", "story", repoRoot);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.artifact.kind).toBe("markdown");
      if (result.artifact.kind === "markdown") {
        expect(result.artifact.title).toBe("Story 3.1");
      }
    }
    void repoRoot;
  });
});
