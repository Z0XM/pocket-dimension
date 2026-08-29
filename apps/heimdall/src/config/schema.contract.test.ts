import { describe, expect, it } from "vitest";
import { defineConfig, heimdallConfigSchema } from "./schema.js";
import { resolveEffectiveBasePath } from "./resolveBasePath.js";

describe("heimdall config contract", () => {
  it("defaults heimdallPath to /heimdall and tests off", () => {
    const cfg = defineConfig({});
    expect(cfg.runtime.heimdallPath).toBe("/heimdall");
    expect(cfg.runtime.uiStoragePrefix).toBe("heimdall");
    expect(cfg.branding.defaultTheme).toBe("dark");
    expect(cfg.pages.tests).toBe(false);
    expect(cfg.pages.testLevels).toBeUndefined();
    expect(cfg.paths.testRoots).toEqual(["src", "tests"]);
    expect(cfg.paths.uiExpectationsDir).toBe("docs/validation/ui-expectations");
    expect(cfg.paths.vitestRunsDir).toBe("docs/validation/reports/vitest-runs");
    expect(cfg.paths.uiRunsDir).toBe("docs/validation/reports/ui-runs");
    expect(cfg.links.apiDocs).toBeNull();
    expect(cfg.links.sample).toBeNull();
    expect(cfg.modules).toEqual([]);
    expect(cfg.synthesizeFeaturesWhenRegistryMissing).toBe(true);
  });

  it("accepts pages.testLevels subset", () => {
    const cfg = defineConfig({ pages: { tests: true, testLevels: ["L1"] } });
    expect(cfg.pages.tests).toBe(true);
    expect(cfg.pages.testLevels).toEqual(["L1"]);
  });

  it("accepts empty sprint/epics for soft-empty dogfood", () => {
    const cfg = defineConfig({
      paths: { sprintStatus: [], epics: [] },
      docs: { extraRoots: ["_bmad-output"] },
    });
    expect(cfg.paths.sprintStatus).toEqual([]);
    expect(cfg.paths.epics).toEqual([]);
    expect(cfg.docs.extraRoots).toContain("_bmad-output");
  });

  it("accepts parser bmad-output and defaults numeric (T1 FR1/FR10)", () => {
    const withBmad = defineConfig({
      paths: { epics: [{ path: "x/epics.md", parser: "bmad-output" }] },
    });
    expect(withBmad.paths.epics[0]!.parser).toBe("bmad-output");
    const def = defineConfig({
      paths: { epics: [{ path: "docs/planning/epics/epics.md" }] },
    });
    expect(def.paths.epics[0]!.parser).toBe("numeric");
  });

  it("accepts unknown parser strings for soft-skip at load (T1 FR2)", () => {
    const cfg = defineConfig({
      paths: { epics: [{ path: "x.md", parser: "not-a-parser" }] },
    });
    expect(cfg.paths.epics[0]!.parser).toBe("not-a-parser");
  });

  it("does not invent a host env name — only consumer-named basePathFromEnv", () => {
    const cfg = defineConfig({ runtime: { heimdallPath: "/heimdall" } });
    expect(cfg.runtime.basePathFromEnv).toBeUndefined();
    const withEnv = defineConfig({
      runtime: { heimdallPath: "/heimdall", basePathFromEnv: "PUBLIC_BASE_PATH" },
    });
    expect(withEnv.runtime.basePathFromEnv).toBe("PUBLIC_BASE_PATH");
  });

  it("resolveEffectiveBasePath prefers explicit basePath", () => {
    const cfg = heimdallConfigSchema.parse({
      runtime: {
        basePath: "/my-app/heimdall",
        heimdallPath: "/heimdall",
        basePathFromEnv: "PUBLIC_BASE_PATH",
      },
    });
    expect(resolveEffectiveBasePath(cfg, { env: {} })).toBe("/my-app/heimdall");
  });

  it("accepts modules[].idPrefix for display labels", () => {
    const cfg = defineConfig({
      modules: [
        {
          id: "heimdall",
          label: "Heimdall",
          basePath: "_bmad-output/planning-artifacts/heimdall",
          idPrefix: "H",
        },
      ],
    });
    expect(cfg.modules[0]!.idPrefix).toBe("H");
  });

  it("defaults branding.defaultTheme to dark and accepts light/dark", () => {
    expect(defineConfig({}).branding.defaultTheme).toBe("dark");
    expect(defineConfig({ branding: { defaultTheme: "light" } }).branding.defaultTheme).toBe("light");
    expect(defineConfig({ branding: { defaultTheme: "dark" } }).branding.defaultTheme).toBe("dark");
  });

  it("rejects invalid branding.defaultTheme at parse time", () => {
    expect(() => defineConfig({ branding: { defaultTheme: "system" as "dark" } })).toThrow();
  });
});
