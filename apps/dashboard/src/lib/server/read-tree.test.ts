import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { isContainedInTree, loadTreeSnapshot } from "./read-tree";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function createTreeFixture(): { repoRoot: string; treePath: string; resolvedTreeRoot: string } {
  const repoRoot = mkdtempSync(join(tmpdir(), "read-tree-test-"));
  tempRoots.push(repoRoot);

  const treePath = join(repoRoot, "_bmad-output", "pocket-dimension");
  mkdirSync(treePath, { recursive: true });

  const resolvedTreeRoot = realpathSync(treePath);

  return { repoRoot, treePath, resolvedTreeRoot };
}

describe("isContainedInTree", () => {
  it("accepts paths whose realpath stays inside the tree root", () => {
    const { treePath, resolvedTreeRoot } = createTreeFixture();
    const inside = join(treePath, "notes.md");
    writeFileSync(inside, "# Inside\n");

    expect(isContainedInTree(resolvedTreeRoot, treePath, inside)).toBe(true);
  });

  it("rejects file symlinks that escape the tree root", () => {
    const { repoRoot, treePath, resolvedTreeRoot } = createTreeFixture();
    const outsideDir = join(repoRoot, "outside");
    mkdirSync(outsideDir, { recursive: true });

    const outsideFile = join(outsideDir, "escaped.md");
    writeFileSync(outsideFile, "# Escaped secret\n");

    const linkPath = join(treePath, "escaped-link.md");
    symlinkSync(outsideFile, linkPath);

    expect(isContainedInTree(resolvedTreeRoot, treePath, linkPath)).toBe(false);
  });

  it("rejects directory symlinks that escape the tree root", () => {
    const { repoRoot, treePath, resolvedTreeRoot } = createTreeFixture();
    const outsideDir = join(repoRoot, "outside-dir");
    mkdirSync(outsideDir, { recursive: true });
    writeFileSync(join(outsideDir, "nested.md"), "# Nested outside\n");

    const linkDir = join(treePath, "trap");
    symlinkSync(outsideDir, linkDir);

    expect(isContainedInTree(resolvedTreeRoot, treePath, linkDir)).toBe(false);
  });
});

describe("loadTreeSnapshot", () => {
  it("does not catalog artifacts reached via outbound symlinks", () => {
    const { repoRoot, treePath } = createTreeFixture();

    writeFileSync(join(treePath, "inside.md"), "# Inside artifact\n");

    const outsideDir = join(repoRoot, "outside-catalog");
    mkdirSync(outsideDir, { recursive: true });
    writeFileSync(join(outsideDir, "escaped.md"), "# Escaped catalog entry\n");
    symlinkSync(join(outsideDir, "escaped.md"), join(treePath, "escaped-link.md"));

    const outsideNested = join(repoRoot, "outside-nested");
    mkdirSync(outsideNested, { recursive: true });
    writeFileSync(join(outsideNested, "nested-escaped.md"), "# Nested escaped\n");
    symlinkSync(outsideNested, join(treePath, "trap-dir"));

    const snapshot = loadTreeSnapshot("pocket-dimension", repoRoot);
    expect(snapshot.artifacts.map((a) => a.sourcePath)).toEqual(["inside.md"]);
    expect(snapshot.artifacts.some((a) => a.title.includes("Escaped"))).toBe(false);
  });
});
