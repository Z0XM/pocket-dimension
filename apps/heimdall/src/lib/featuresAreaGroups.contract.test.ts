import { describe, expect, it } from "vitest";
import type { FeatureRecord } from "@/types/dashboard";
import {
  areaFilterKey,
  featureMatchesAreaFilter,
  groupFeaturesByModuleThenArea,
  parseAreaFilterKey,
  shouldNestFeaturesByModule,
} from "./featuresAreaGroups";

function feat(partial: Partial<FeatureRecord> & Pick<FeatureRecord, "id" | "areaId" | "moduleId">): FeatureRecord {
  return {
    name: partial.id,
    epicId: "epic-1",
    screens: [],
    status: "Live",
    includes: [],
    deferred: [],
    seeAlso: [],
    outOfScope: [],
    area: partial.areaId,
    moduleLabel: partial.moduleId,
    ...partial,
  };
}

describe("featuresAreaGroups", () => {
  it("nests only for multi-module view-all", () => {
    const mods = [
      { id: "heimdall", label: "H" },
      { id: "sql-engine", label: "SQL" },
    ];
    expect(shouldNestFeaturesByModule(mods, "all")).toBe(true);
    expect(shouldNestFeaturesByModule(mods, "heimdall")).toBe(false);
    expect(shouldNestFeaturesByModule([{ id: "heimdall", label: "H" }], "all")).toBe(false);
  });

  it("groups areas under each enabled module in config order", () => {
    const modules = [
      { id: "heimdall", label: "@pocket-dimension/heimdall" },
      { id: "sql-engine", label: "@compenly/sql-engine" },
      { id: "commons", label: "@compenly/commons" },
    ];
    const features = [
      feat({ id: "heimdall:F-1", areaId: "cli", moduleId: "heimdall" }),
      feat({ id: "sql-engine:F-1", areaId: "parser", moduleId: "sql-engine" }),
      feat({ id: "heimdall:F-2", areaId: "other", moduleId: "heimdall" }),
    ];
    const groups = groupFeaturesByModuleThenArea(features, modules, new Map());
    expect(groups.map((g) => g.moduleId)).toEqual(["heimdall", "sql-engine", "commons"]);
    expect(groups[0]!.areas.map((a) => a.id)).toEqual(["cli", "other"]);
    expect(groups[1]!.areas.map((a) => a.id)).toEqual(["parser"]);
    expect(groups[2]!.areas).toEqual([]);
    expect(groups[2]!.featureCount).toBe(0);
  });

  it("uses compound filter keys so same areaId does not cross modules", () => {
    expect(areaFilterKey("heimdall", "other")).toBe("heimdall::other");
    expect(parseAreaFilterKey("heimdall::other")).toEqual({
      moduleId: "heimdall",
      areaId: "other",
    });
    const a = feat({ id: "heimdall:F-1", areaId: "other", moduleId: "heimdall" });
    const b = feat({ id: "sql-engine:F-1", areaId: "other", moduleId: "sql-engine" });
    expect(featureMatchesAreaFilter(a, "heimdall::other", true)).toBe(true);
    expect(featureMatchesAreaFilter(b, "heimdall::other", true)).toBe(false);
  });
});
