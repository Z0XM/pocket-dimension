/**
 * FR-18 Modules contract matrix (Story 3.4)
 *
 * Coverage map — each bullet has at least one named case below; fuller suites live in sibling files:
 *
 * | # | Bullet | Primary sibling coverage |
 * |---|--------|--------------------------|
 * | A | Flat config unchanged | resolveModules.contract.test.ts — flat default / modules: [] |
 * | B | Modules register / filter | resolveModules + moduleScope (server) — enabled filter |
 * | C | Module Base Path + relative resolve | resolveModules.contract.test.ts — basePath join / escape / .. reject |
 * | D | FR present suppresses synthesis | frAuthority.contract.test.ts — FR rows only, no feat-* |
 * | E | Synthesis flag false → Soft-empty | frAuthority.contract.test.ts — features: [] when flag false |
 * | F | View-all id disambiguation | frAuthority.contract.test.ts — epic-mod-a-1 vs epic-mod-b-1 |
 * | G | Soft-empty per optional index | **this file** — missing optional indexes, epics/features populated |
 * | H | Module Scope control visibility | src/lib/moduleScope.contract.test.ts — shouldShowModuleScopeControl |
 */
import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig } from "../src/config/schema.js";
import { listEnabledModules, ModulePathEscapeError, resolveModulePlanningPath, resolveModules } from "../src/config/resolveModules.js";
import { shouldShowModuleScopeControl } from "../src/lib/moduleScope.js";
import { loadDashboard, runtimeModuleList } from "./loadDashboard.js";

const BMAD_EPICS = `# Module

## Epic 1: Matrix epic

Goal for matrix tests.

### Story 1.1: Matrix story

As a maintainer,
I want coverage,
So that FR-18 cannot regress.

**Acceptance Criteria:**

**Given** setup
**When** action
**Then** result
`;

const FR_TABLE = `| ID | Name | Screens | Owner | Epic | Status |
| --- | --- | --- | --- | --- | --- |
| F-1 | Matrix Feature | SCR-1 | PM | Epic 1 | Live |
`;

function writeModuleWithFr(root: string, moduleId: string): void {
  const modDir = path.join(root, "modules", moduleId);
  mkdirSync(modDir, { recursive: true });
  writeFileSync(path.join(modDir, "epics.md"), BMAD_EPICS);
  writeFileSync(path.join(modDir, "FEATURE-REGISTRY.md"), FR_TABLE);
}

describe("FR-18 Modules contract matrix", () => {
  describe("A — flat config unchanged", () => {
    it("modules omitted or [] → implicit default Module id default with SI path defaults", () => {
      const root = mkdtempSync(path.join(tmpdir(), "heimdall-fr18-a-"));
      const omitted = resolveModules(defineConfig({}), root);
      const emptyArr = resolveModules(defineConfig({ modules: [] }), root);

      expect(omitted).toEqual(emptyArr);
      expect(omitted).toHaveLength(1);
      expect(omitted[0]).toMatchObject({ id: "default", enabled: true, basePath: "." });

      const runtime = runtimeModuleList(defineConfig({}), root);
      expect(runtime).toEqual([{ id: "default", label: omitted[0]!.label }]);
    });
  });

  describe("B — Modules register / filter", () => {
    it("non-empty modules resolve; enabled false excluded from Enabled list and runtime", () => {
      const root = mkdtempSync(path.join(tmpdir(), "heimdall-fr18-b-"));
      const config = defineConfig({
        modules: [
          { id: "on", label: "On", basePath: "modules/on", paths: {} },
          {
            id: "off",
            label: "Off",
            enabled: false,
            basePath: "modules/off",
            paths: {},
          },
        ],
      });

      const enabled = listEnabledModules(resolveModules(config, root));
      expect(enabled.map((m) => m.id)).toEqual(["on"]);
      expect(runtimeModuleList(config, root).map((m) => m.id)).toEqual(["on"]);
    });
  });

  describe("C — Module Base Path + relative resolve", () => {
    it("relative paths join under basePath; escape hatch under repoRoot; .. rejected", () => {
      const repoRoot = mkdtempSync(path.join(tmpdir(), "heimdall-fr18-c-"));

      const joined = resolveModulePlanningPath(repoRoot, "pkg/mod", "FEATURE-REGISTRY.md");
      expect(joined).toBe(path.resolve(repoRoot, "pkg/mod/FEATURE-REGISTRY.md"));

      const escape = resolveModulePlanningPath(repoRoot, "pkg/mod", "_bmad-output/artifacts/epics.md");
      expect(escape).toBe(path.resolve(repoRoot, "_bmad-output/artifacts/epics.md"));

      expect(() => resolveModulePlanningPath(repoRoot, "pkg/mod", "../escape/FEATURE-REGISTRY.md")).toThrow(ModulePathEscapeError);
    });
  });

  describe("D — FR present suppresses synthesis", () => {
    it("Modules mode + parseable FR with rows → Features from FR only; no feat-* synthesis", () => {
      const root = mkdtempSync(path.join(tmpdir(), "heimdall-fr18-d-"));
      writeModuleWithFr(root, "mod-a");

      const config = defineConfig({
        repoRoot: root,
        modules: [
          {
            id: "mod-a",
            label: "Module A",
            basePath: "modules/mod-a",
            paths: {
              epics: [{ path: "epics.md", parser: "bmad-output" }],
              featureRegistry: "FEATURE-REGISTRY.md",
            },
          },
        ],
      });

      const snap = loadDashboard(root, config, "mod-a");
      expect(snap.features.some((f) => f.id === "mod-a:F-1")).toBe(true);
      expect(snap.features.every((f) => !f.id.startsWith("feat-"))).toBe(true);
      expect(snap.epics.length).toBeGreaterThan(0);
    });
  });

  describe("E — synthesis flag false → Soft-empty Features", () => {
    it("synthesizeFeaturesWhenRegistryMissing false + missing FR → features: [] without crash", () => {
      const root = mkdtempSync(path.join(tmpdir(), "heimdall-fr18-e-"));
      const modDir = path.join(root, "modules", "mod-a");
      mkdirSync(modDir, { recursive: true });
      writeFileSync(path.join(modDir, "epics.md"), BMAD_EPICS);

      const config = defineConfig({
        repoRoot: root,
        synthesizeFeaturesWhenRegistryMissing: false,
        modules: [
          {
            id: "mod-a",
            label: "Module A",
            basePath: "modules/mod-a",
            paths: {
              epics: [{ path: "epics.md", parser: "bmad-output" }],
              featureRegistry: "MISSING-FEATURE-REGISTRY.md",
            },
          },
        ],
      });

      expect(() => loadDashboard(root, config, "mod-a")).not.toThrow();
      const snap = loadDashboard(root, config, "mod-a");
      expect(snap.features).toEqual([]);
      expect(snap.epics.length).toBeGreaterThan(0);
    });
  });

  describe("F — view-all id disambiguation", () => {
    it("module=all → epic/feature/story ids namespaced by module.id; no collisions", () => {
      const root = mkdtempSync(path.join(tmpdir(), "heimdall-fr18-f-"));
      writeModuleWithFr(root, "mod-a");
      writeModuleWithFr(root, "mod-b");

      const config = defineConfig({
        repoRoot: root,
        modules: [
          {
            id: "mod-a",
            label: "Module A",
            basePath: "modules/mod-a",
            paths: {
              epics: [{ path: "epics.md", parser: "bmad-output" }],
              featureRegistry: "FEATURE-REGISTRY.md",
            },
          },
          {
            id: "mod-b",
            label: "Module B",
            basePath: "modules/mod-b",
            paths: {
              epics: [{ path: "epics.md", parser: "bmad-output" }],
              featureRegistry: "FEATURE-REGISTRY.md",
            },
          },
        ],
      });

      const snap = loadDashboard(root, config, "all");
      const epicIds = snap.epics.map((e) => e.id);
      expect(epicIds).toContain("epic-mod-a-1");
      expect(epicIds).toContain("epic-mod-b-1");
      expect(new Set(epicIds).size).toBe(epicIds.length);

      const featureIds = snap.features.map((f) => f.id);
      expect(featureIds).toContain("mod-a:F-1");
      expect(featureIds).toContain("mod-b:F-1");
      expect(new Set(featureIds).size).toBe(featureIds.length);
    });
  });

  describe("G — Soft-empty per optional index", () => {
    it("Modules mode: configured but missing intake/deferred/externalGaps Soft-empty those arrays only", () => {
      const root = mkdtempSync(path.join(tmpdir(), "heimdall-fr18-g-miss-"));
      writeModuleWithFr(root, "mod-a");

      const config = defineConfig({
        repoRoot: root,
        modules: [
          {
            id: "mod-a",
            label: "Module A",
            basePath: "modules/mod-a",
            paths: {
              epics: [{ path: "epics.md", parser: "bmad-output" }],
              featureRegistry: "FEATURE-REGISTRY.md",
              intakeIndex: "INTAKE-INDEX.md",
              deferredIndex: "DEFERRED-INDEX.md",
              externalGaps: "EXTERNAL-GAPS.md",
            },
          },
        ],
      });

      expect(() => loadDashboard(root, config, "mod-a")).not.toThrow();
      const snap = loadDashboard(root, config, "mod-a");
      expect(snap.epics.length).toBeGreaterThan(0);
      expect(snap.features.length).toBeGreaterThan(0);
      expect(snap.stories.length).toBeGreaterThan(0);
      expect(snap.openQuestions).toEqual([]);
      expect(snap.deferredItems).toEqual([]);
      expect(snap.externalGaps).toEqual([]);
    });

    it("Modules mode: omitted optional index keys Soft-empty those surfaces without crash", () => {
      const root = mkdtempSync(path.join(tmpdir(), "heimdall-fr18-g-omit-"));
      writeModuleWithFr(root, "mod-a");

      const config = defineConfig({
        repoRoot: root,
        modules: [
          {
            id: "mod-a",
            label: "Module A",
            basePath: "modules/mod-a",
            paths: {
              epics: [{ path: "epics.md", parser: "bmad-output" }],
              featureRegistry: "FEATURE-REGISTRY.md",
            },
          },
        ],
      });

      expect(() => loadDashboard(root, config, "mod-a")).not.toThrow();
      const snap = loadDashboard(root, config, "mod-a");
      expect(snap.epics.length).toBeGreaterThan(0);
      expect(snap.features.length).toBeGreaterThan(0);
      expect(snap.openQuestions).toEqual([]);
      expect(snap.deferredItems).toEqual([]);
      expect(snap.externalGaps).toEqual([]);
    });
  });

  describe("H — Module Scope control visibility", () => {
    it("shouldShowModuleScopeControl hidden when flat or ≤1 Enabled; shown when >1 Enabled", () => {
      expect(shouldShowModuleScopeControl([])).toBe(false);
      expect(shouldShowModuleScopeControl([{ id: "default", label: "Flat" }])).toBe(false);
      expect(
        shouldShowModuleScopeControl([
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ])
      ).toBe(true);
    });
  });
});
