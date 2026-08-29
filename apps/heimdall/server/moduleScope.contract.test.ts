import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig } from "../src/config/schema.js";
import { loadDashboard, normalizeDashboardScopeKey, resolveScopeModules, runtimeModuleList } from "./loadDashboard.js";

const MOD_A_EPICS = `# Module A

## Epic 1: Alpha epic

Goal for alpha.

### Story 1.1: First alpha story

As a user,
I want alpha,
So that tests pass.

**Acceptance Criteria:**

**Given** setup
**When** action
**Then** result
`;

const MOD_B_EPICS = `# Module B

## Epic 1: Beta epic

Goal for beta.

### Story 1.1: First beta story

As a user,
I want beta,
So that tests pass.
`;

function writeModuleFixture(root: string, moduleId: string, epicsContent: string): void {
  const modDir = path.join(root, "modules", moduleId);
  mkdirSync(modDir, { recursive: true });
  writeFileSync(path.join(modDir, "epics.md"), epicsContent);
}

function multiModuleConfig(root: string) {
  return defineConfig({
    repoRoot: root,
    paths: {
      sprintStatus: [],
      epics: [],
      featureRegistry: "missing-features.md",
      intakeIndex: "missing-intake.md",
      deferredIndex: "missing-deferred.md",
      implementationDir: "implementation",
    },
    modules: [
      {
        id: "mod-a",
        label: "Module A",
        basePath: "modules/mod-a",
        paths: {
          epics: [{ path: "epics.md", parser: "bmad-output" }],
        },
      },
      {
        id: "mod-b",
        label: "Module B",
        basePath: "modules/mod-b",
        paths: {
          epics: [{ path: "epics.md", parser: "bmad-output" }],
        },
      },
      {
        id: "mod-off",
        label: "Disabled",
        enabled: false,
        basePath: "modules/mod-off",
        paths: {
          epics: [{ path: "epics.md", parser: "bmad-output" }],
        },
      },
    ],
  });
}

describe("module scope contract", () => {
  it("flat defineConfig({}) exposes one default Module on runtime list", () => {
    const root = mkdtempSync(path.join(tmpdir(), "heimdall-mod-flat-"));
    const config = defineConfig({ branding: { subtitle: "Flat subtitle" } });

    const modules = runtimeModuleList(config, root);
    expect(modules).toEqual([{ id: "default", label: "Flat subtitle" }]);
  });

  it("runtime list includes Enabled Modules only (disabled omitted)", () => {
    const root = mkdtempSync(path.join(tmpdir(), "heimdall-mod-rt-"));
    writeModuleFixture(root, "mod-a", MOD_A_EPICS);
    writeModuleFixture(root, "mod-b", MOD_B_EPICS);
    writeModuleFixture(root, "mod-off", `# Off\n\n## Epic 1: Should not appear\n\nHidden.\n`);

    const config = multiModuleConfig(root);
    const modules = runtimeModuleList(config, root);
    expect(modules.map((m) => m.id)).toEqual(["mod-a", "mod-b"]);
  });

  it("scoped load returns only that Module's epics", () => {
    const root = mkdtempSync(path.join(tmpdir(), "heimdall-mod-scope-"));
    writeModuleFixture(root, "mod-a", MOD_A_EPICS);
    writeModuleFixture(root, "mod-b", MOD_B_EPICS);
    writeModuleFixture(root, "mod-off", MOD_A_EPICS);

    const config = multiModuleConfig(root);
    const snap = loadDashboard(root, config, "mod-a");

    expect(snap.epics.some((e) => e.title.includes("Alpha"))).toBe(true);
    expect(snap.epics.some((e) => e.title.includes("Beta"))).toBe(false);
    expect(snap.epics.every((e) => e.id.includes("mod-a"))).toBe(true);
  });

  it("module=all unions Enabled Modules and omits disabled content", () => {
    const root = mkdtempSync(path.join(tmpdir(), "heimdall-mod-all-"));
    writeModuleFixture(root, "mod-a", MOD_A_EPICS);
    writeModuleFixture(root, "mod-b", MOD_B_EPICS);
    writeModuleFixture(root, "mod-off", `# Off\n\n## Epic 1: Disabled epic\n\nShould not load.\n`);

    const config = multiModuleConfig(root);
    const snap = loadDashboard(root, config, "all");

    const titles = snap.epics.map((e) => e.title);
    expect(titles.some((t) => t.includes("Alpha"))).toBe(true);
    expect(titles.some((t) => t.includes("Beta"))).toBe(true);
    expect(titles.some((t) => t.includes("Disabled"))).toBe(false);
    expect(snap.epics.length).toBeGreaterThanOrEqual(2);
  });

  it("missing optional Module files Soft-empty without throw", () => {
    const root = mkdtempSync(path.join(tmpdir(), "heimdall-mod-miss-"));
    const config = defineConfig({
      modules: [
        {
          id: "empty-mod",
          label: "Empty",
          basePath: "missing/module",
          paths: {
            epics: [{ path: "epics.md", parser: "bmad-output" }],
            featureRegistry: "FEATURE-REGISTRY.md",
          },
        },
      ],
    });

    expect(() => loadDashboard(root, config, "empty-mod")).not.toThrow();
    const snap = loadDashboard(root, config, "empty-mod");
    expect(snap.epics).toEqual([]);
    expect(snap.features).toEqual([]);
    expect(snap.summary).toBeDefined();
  });

  it("unknown or disabled scope falls back to first Enabled Module", () => {
    const root = mkdtempSync(path.join(tmpdir(), "heimdall-mod-fb-"));
    writeModuleFixture(root, "mod-a", MOD_A_EPICS);
    writeModuleFixture(root, "mod-b", MOD_B_EPICS);

    const config = multiModuleConfig(root);
    const unknown = loadDashboard(root, config, "does-not-exist");
    const disabled = loadDashboard(root, config, "mod-off");

    expect(unknown.epics.some((e) => e.title.includes("Alpha"))).toBe(true);
    expect(disabled.epics.some((e) => e.title.includes("Alpha"))).toBe(true);
    expect(resolveScopeModules("mod-off", config, root).map((m) => m.id)).toEqual(["mod-a"]);
  });

  it("omitted scope behaves as all when multiple Enabled Modules", () => {
    const root = mkdtempSync(path.join(tmpdir(), "heimdall-mod-omit-"));
    writeModuleFixture(root, "mod-a", MOD_A_EPICS);
    writeModuleFixture(root, "mod-b", MOD_B_EPICS);

    const config = multiModuleConfig(root);
    const omitted = loadDashboard(root, config);
    const explicitAll = loadDashboard(root, config, "all");

    expect(omitted.epics.length).toBe(explicitAll.epics.length);
    expect(normalizeDashboardScopeKey(undefined, config, root)).toBe("all");
  });

  it("omitted scope loads sole Enabled Module when only one", () => {
    const root = mkdtempSync(path.join(tmpdir(), "heimdall-mod-one-"));
    writeModuleFixture(root, "mod-a", MOD_A_EPICS);

    const config = defineConfig({
      modules: [
        {
          id: "mod-a",
          label: "Module A",
          basePath: "modules/mod-a",
          paths: {
            epics: [{ path: "epics.md", parser: "bmad-output" }],
          },
        },
      ],
    });

    const snap = loadDashboard(root, config);
    expect(snap.epics.some((e) => e.title.includes("Alpha"))).toBe(true);
    expect(normalizeDashboardScopeKey(undefined, config, root)).toBe("mod-a");
  });

  it("zero Enabled Modules returns Soft-empty snapshot", () => {
    const root = mkdtempSync(path.join(tmpdir(), "heimdall-mod-zero-"));
    const config = defineConfig({
      modules: [
        {
          id: "off",
          label: "Off",
          enabled: false,
          basePath: "modules/off",
          paths: {},
        },
      ],
    });

    const snap = loadDashboard(root, config, "all");
    expect(snap.epics).toEqual([]);
    expect(snap.stories).toEqual([]);
    expect(snap.meta).toBeDefined();
    expect(normalizeDashboardScopeKey("all", config, root)).toBe("__empty__");
  });
});
