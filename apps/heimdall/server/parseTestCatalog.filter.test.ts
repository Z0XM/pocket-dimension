import { describe, expect, it } from "vitest";
import { filterTestCatalogByLevels } from "./parseTestCatalog.js";
import { resolveEnabledTestLevels } from "../src/config/testLevels.js";
import type { TestCatalog } from "./types.js";

const sample: TestCatalog = {
  files: [
    {
      path: "a.test.ts",
      area: "core",
      level: "L1",
      suiteName: "a",
      caseCount: 2,
      cases: [
        { name: "one", suitePath: [] },
        { name: "two", suitePath: [] },
      ],
    },
    {
      path: "b.test.ts",
      area: "core",
      level: "L2",
      suiteName: "b",
      caseCount: 1,
      cases: [{ name: "three", suitePath: [] }],
    },
  ],
  summary: {
    fileCount: 2,
    caseCount: 3,
    byLevel: { L1: 2, L2: 1, L3: 0, L4: 0, tooling: 0 },
  },
  generatedAt: "2026-01-01T00:00:00.000Z",
};

describe("filterTestCatalogByLevels", () => {
  it("keeps only enabled Vitest levels", () => {
    const filtered = filterTestCatalogByLevels(sample, resolveEnabledTestLevels(["L1"]));
    expect(filtered.files).toHaveLength(1);
    expect(filtered.files[0]!.level).toBe("L1");
    expect(filtered.summary.caseCount).toBe(2);
    expect(filtered.summary.byLevel.L1).toBe(2);
    expect(filtered.summary.byLevel.L2).toBe(0);
  });
});
