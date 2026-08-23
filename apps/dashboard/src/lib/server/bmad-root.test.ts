import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CURRENT_BMAD_TREES, listCurrentTrees, resolveBmadRoot, resolveTreePath } from "./bmad-root";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function createRepoFixture(options?: { trees?: string[]; leftovers?: string[]; nestedStart?: boolean }): { repoRoot: string; nestedDir?: string } {
  const repoRoot = mkdtempSync(join(tmpdir(), "bmad-root-test-"));
  tempRoots.push(repoRoot);

  const bmadOutput = join(repoRoot, "_bmad-output");
  mkdirSync(bmadOutput, { recursive: true });

  for (const slug of options?.trees ?? [...CURRENT_BMAD_TREES]) {
    mkdirSync(join(bmadOutput, slug), { recursive: true });
  }

  for (const leftover of options?.leftovers ?? []) {
    mkdirSync(join(bmadOutput, leftover), { recursive: true });
  }

  writeFileSync(join(bmadOutput, "README.md"), "# BMAD output\n");

  if (options?.nestedStart) {
    const nestedDir = join(repoRoot, "apps", "dashboard", "src", "lib", "server");
    mkdirSync(nestedDir, { recursive: true });
    return { repoRoot, nestedDir };
  }

  return { repoRoot };
}

describe("resolveBmadRoot", () => {
  it("walks up from a nested start path until _bmad-output is found", () => {
    const { repoRoot, nestedDir } = createRepoFixture({ nestedStart: true });
    expect(nestedDir).toBeDefined();

    const result = resolveBmadRoot([nestedDir!]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.root).toBe(repoRoot);
    }
  });

  it("returns a failure when _bmad-output is missing", () => {
    const orphan = mkdtempSync(join(tmpdir(), "bmad-root-missing-"));
    tempRoots.push(orphan);

    const result = resolveBmadRoot([orphan]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("_bmad-output");
    }
  });
});

describe("listCurrentTrees", () => {
  it("returns allow-listed trees that exist on disk in README order", () => {
    const { repoRoot } = createRepoFixture({ trees: ["zeo", "pocket-dimension"] });

    const result = listCurrentTrees(repoRoot);
    expect(result.trees).toEqual(["pocket-dimension", "zeo"]);
    expect(result.bmadRootError).toBeUndefined();
  });

  it("ignores leftover first-level folders under _bmad-output", () => {
    const { repoRoot } = createRepoFixture({
      trees: ["pocket-dimension"],
      leftovers: ["rhymes", "tmp"],
    });

    const result = listCurrentTrees(repoRoot);
    expect(result.trees).toEqual(["pocket-dimension"]);
    expect(result.trees).not.toContain("rhymes");
    expect(result.trees).not.toContain("tmp");
  });

  it("returns empty trees and an error when BMAD Root is missing", () => {
    const orphan = mkdtempSync(join(tmpdir(), "bmad-root-empty-"));
    tempRoots.push(orphan);

    const result = listCurrentTrees(orphan);
    expect(result.trees).toEqual([]);
    expect(result.bmadRootError).toContain("_bmad-output");
  });
});

describe("resolveTreePath", () => {
  it("resolves an allow-listed tree directory", () => {
    const { repoRoot } = createRepoFixture({ trees: ["zeo"] });

    const result = resolveTreePath("zeo", repoRoot);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.path.endsWith(`${join("_bmad-output", "zeo")}`)).toBe(true);
    }
  });

  it("rejects trees outside the allow-list", () => {
    const { repoRoot } = createRepoFixture({ leftovers: ["rhymes"] });

    const result = resolveTreePath("rhymes", repoRoot);
    expect(result.ok).toBe(false);
  });

  it("rejects symlink escapes outside _bmad-output/<slug>", () => {
    const { repoRoot } = createRepoFixture({ trees: ["zeo"] });
    const outside = join(repoRoot, "outside");
    mkdirSync(outside, { recursive: true });

    const zeoPath = join(repoRoot, "_bmad-output", "zeo");
    rmSync(zeoPath, { recursive: true, force: true });
    symlinkSync(outside, zeoPath);

    const result = resolveTreePath("zeo", repoRoot);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("allow-list");
    }
  });
});
