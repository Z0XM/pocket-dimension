import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadTestsCatalog } from "./tests-catalog";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function createRepoFixture(): string {
  const repoRoot = mkdtempSync(join(tmpdir(), "tests-catalog-"));
  tempRoots.push(repoRoot);

  mkdirSync(join(repoRoot, "_bmad-output", "pocket-dimension"), { recursive: true });

  mkdirSync(join(repoRoot, "apps", "zeo", "src", "lib"), { recursive: true });
  writeFileSync(join(repoRoot, "apps", "zeo", "src", "lib", "snapshot.test.ts"), "test('snapshot', () => {});");

  mkdirSync(join(repoRoot, "apps", "chhan-chhan", "src", "lib", "importers"), { recursive: true });
  writeFileSync(join(repoRoot, "apps", "chhan-chhan", "src", "lib", "importers", "finance.spec.ts"), "test('finance', () => {});");

  mkdirSync(join(repoRoot, "apps", "dashboard", "src", "lib"), { recursive: true });
  writeFileSync(join(repoRoot, "apps", "dashboard", "src", "lib", "nav.test.ts"), "test('nav', () => {});");

  mkdirSync(join(repoRoot, "_bmad-output", "pocket-dimension", "implementation-artifacts"), { recursive: true });
  writeFileSync(join(repoRoot, "_bmad-output", "pocket-dimension", "implementation-artifacts", "fake.test.ts"), "test('bmad', () => {});");

  mkdirSync(join(repoRoot, "packages", "shared"), { recursive: true });
  writeFileSync(join(repoRoot, "packages", "shared", "utils.test.ts"), "test('outside', () => {});");

  return repoRoot;
}

describe("loadTestsCatalog", () => {
  it("finds test files under apps/ and maps treeHint", () => {
    const repoRoot = createRepoFixture();
    const entries = loadTestsCatalog(repoRoot);

    expect(entries.map((entry) => entry.sourcePath)).toEqual([
      "apps/chhan-chhan/src/lib/importers/finance.spec.ts",
      "apps/dashboard/src/lib/nav.test.ts",
      "apps/zeo/src/lib/snapshot.test.ts",
    ]);

    const zeo = entries.find((entry) => entry.sourcePath.includes("zeo"));
    const chhan = entries.find((entry) => entry.sourcePath.includes("chhan-chhan"));
    const dashboard = entries.find((entry) => entry.sourcePath.includes("dashboard"));

    expect(zeo?.treeHint).toBe("zeo");
    expect(chhan?.treeHint).toBe("chhan-chhan");
    expect(dashboard?.treeHint).toBeNull();
  });

  it("ignores _bmad-output and paths outside apps/", () => {
    const repoRoot = createRepoFixture();
    const entries = loadTestsCatalog(repoRoot);

    expect(entries.some((entry) => entry.sourcePath.includes("_bmad-output"))).toBe(false);
    expect(entries.some((entry) => entry.sourcePath.startsWith("packages/"))).toBe(false);
  });

  it("returns empty when apps/ has no test files", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "tests-catalog-empty-"));
    tempRoots.push(repoRoot);

    mkdirSync(join(repoRoot, "_bmad-output", "pocket-dimension"), { recursive: true });
    mkdirSync(join(repoRoot, "apps", "zeo", "src"), { recursive: true });
    writeFileSync(join(repoRoot, "apps", "zeo", "src", "index.ts"), "export const x = 1;");

    expect(loadTestsCatalog(repoRoot)).toEqual([]);
  });
});
