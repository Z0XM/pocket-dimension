import path from "node:path";
import { describe, expect, it } from "vitest";
import { defineConfig } from "./schema.js";
import { listEnabledModules, ModulePathEscapeError, resolveModulePlanningPath, resolveModules } from "./resolveModules.js";

const repoRoot = path.resolve("/repo");

describe("resolveModules contract", () => {
  it("flat defineConfig({}) resolves to one implicit default Module with SI path defaults", () => {
    const config = defineConfig({});
    expect(config.synthesizeFeaturesWhenRegistryMissing).toBe(true);
    expect(config.modules).toEqual([]);

    const modules = resolveModules(config, repoRoot);
    expect(modules).toHaveLength(1);
    expect(modules[0]).toMatchObject({
      id: "default",
      enabled: true,
      basePath: ".",
    });
    expect(modules[0]!.paths.featureRegistry).toBe(path.resolve(repoRoot, "docs/requirements/FEATURE-REGISTRY.md"));
    expect(modules[0]!.paths.epics![0]!.path).toBe(path.resolve(repoRoot, "docs/planning/epics/epics.md"));
  });

  it("modules: [] is equivalent to omit (implicit default)", () => {
    const omitted = resolveModules(defineConfig({}), repoRoot);
    const empty = resolveModules(defineConfig({ modules: [] }), repoRoot);
    expect(empty).toEqual(omitted);
  });

  it("non-empty modules resolve planning paths under basePath", () => {
    const config = defineConfig({
      modules: [
        {
          id: "heimdall",
          label: "@pocket-dimension/heimdall",
          basePath: "_bmad-output/planning-artifacts/heimdall",
          paths: {
            featureRegistry: "FEATURE-REGISTRY.md",
            epics: [{ path: "epics.md", parser: "bmad-output" }],
          },
        },
      ],
    });

    const [mod] = resolveModules(config, repoRoot);
    expect(mod!.paths.featureRegistry).toBe(path.resolve(repoRoot, "_bmad-output/planning-artifacts/heimdall/FEATURE-REGISTRY.md"));
    expect(mod!.paths.epics![0]!.path).toBe(path.resolve(repoRoot, "_bmad-output/planning-artifacts/heimdall/epics.md"));
    expect(mod!.paths.epics![0]!.parser).toBe("bmad-output");
  });

  it("enabled defaults true; disabled modules excluded from Enabled list", () => {
    const config = defineConfig({
      modules: [
        {
          id: "active",
          label: "Active",
          basePath: "pkg/active",
          paths: {},
        },
        {
          id: "off",
          label: "Off",
          enabled: false,
          basePath: "pkg/off",
          paths: {},
        },
      ],
    });

    expect(config.modules[0]!.enabled).toBe(true);

    const all = resolveModules(config, repoRoot);
    expect(all).toHaveLength(2);

    const enabled = listEnabledModules(all);
    expect(enabled.map((m) => m.id)).toEqual(["active"]);
  });

  it("escape hatch resolves _bmad-output/ and docs/ under repoRoot only", () => {
    const bmad = resolveModulePlanningPath(repoRoot, "pkg/mod", "_bmad-output/implementation-artifacts/heimdall/sprint-status.yaml");
    expect(bmad).toBe(path.resolve(repoRoot, "_bmad-output/implementation-artifacts/heimdall/sprint-status.yaml"));

    const docs = resolveModulePlanningPath(repoRoot, "pkg/mod", "docs/project-context.md");
    expect(docs).toBe(path.resolve(repoRoot, "docs/project-context.md"));
  });

  it("rejects .. escape above module basePath", () => {
    expect(() => resolveModulePlanningPath(repoRoot, "pkg/mod", "../other/FEATURE-REGISTRY.md")).toThrow(ModulePathEscapeError);
  });

  it("rejects .. escape above repoRoot for escape-hatch paths", () => {
    expect(() => resolveModulePlanningPath(repoRoot, "pkg/mod", "docs/../../outside.md")).toThrow(ModulePathEscapeError);
  });

  it("accepts synthesizeFeaturesWhenRegistryMissing false", () => {
    const config = defineConfig({ synthesizeFeaturesWhenRegistryMissing: false });
    expect(config.synthesizeFeaturesWhenRegistryMissing).toBe(false);
  });
});
