import { afterEach, describe, expect, it } from "bun:test";
import { filterTestsForTree } from "./filter-tests";
import type { TestCatalogEntry } from "$lib/types";

const sampleTests: TestCatalogEntry[] = [
  {
    id: "apps-zeo-snapshot-test-ts",
    name: "snapshot.test.ts",
    sourcePath: "apps/zeo/src/lib/server/game/snapshot.test.ts",
    treeHint: "zeo",
    relatedStoryHref: null,
    href: "/tests/apps/zeo/src/lib/server/game/snapshot.test.ts",
  },
  {
    id: "apps-chhan-chhan-importers-finance-test-ts",
    name: "finance.test.ts",
    sourcePath: "apps/chhan-chhan/src/lib/importers/finance.test.ts",
    treeHint: "chhan-chhan",
    relatedStoryHref: null,
    href: "/tests/apps/chhan-chhan/src/lib/importers/finance.test.ts",
  },
  {
    id: "apps-dashboard-nav-test-ts",
    name: "nav.test.ts",
    sourcePath: "apps/dashboard/src/lib/nav.test.ts",
    treeHint: null,
    relatedStoryHref: null,
    href: "/tests/apps/dashboard/src/lib/nav.test.ts",
  },
];

describe("filterTestsForTree", () => {
  it("returns empty when no tree is selected", () => {
    expect(filterTestsForTree(sampleTests, null)).toEqual([]);
  });

  it("returns full catalog for pocket-dimension", () => {
    expect(filterTestsForTree(sampleTests, "pocket-dimension")).toEqual(sampleTests);
  });

  it("prefix-filters zeo tests", () => {
    expect(filterTestsForTree(sampleTests, "zeo")).toEqual([sampleTests[0]]);
  });

  it("prefix-filters chhan-chhan tests", () => {
    expect(filterTestsForTree(sampleTests, "chhan-chhan")).toEqual([sampleTests[1]]);
  });
});
