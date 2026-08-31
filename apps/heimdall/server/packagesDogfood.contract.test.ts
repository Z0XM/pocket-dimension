import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { defineConfig } from "../src/config/schema.js";
import { listEnabledModules, resolveModules } from "../src/config/resolveModules.js";
import { loadDashboard } from "./loadDashboard.js";

/** Pocket Dimension monorepo root (apps/heimdall/server → ../../..) */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("pocket-dimension root Heimdall entrypoint", () => {
  it("exposes private root package.json with heimdall script", () => {
    const packageJsonPath = path.join(repoRoot, "package.json");
    expect(existsSync(packageJsonPath)).toBe(true);

    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      private?: boolean;
      scripts?: Record<string, string>;
      workspaces?: string[];
    };

    expect(pkg.private).toBe(true);
    expect(pkg.scripts?.heimdall).toBe("node ./apps/heimdall/bin/heimdall.cjs");
    expect(pkg.scripts?.["dev:app:heimdall"]).toContain("@pocket-dimension/heimdall");
    expect(pkg.scripts?.["build:app:heimdall"]).toContain("@pocket-dimension/heimdall");
    expect(pkg.workspaces).toEqual(expect.arrayContaining(["apps/**", "shared/**", "scripts/**"]));
  });
});

describe("pocket-dimension Heimdall dogfood config", () => {
  it("loads root heimdall.config.mjs and resolves enabled modules", async () => {
    const configPath = path.join(repoRoot, "heimdall.config.mjs");
    expect(existsSync(configPath)).toBe(true);

    const mod = await import(configPath);
    const config = defineConfig(mod.default);

    expect(config.synthesizeFeaturesWhenRegistryMissing).toBe(false);
    expect(config.links?.sample ?? null).toBeNull();

    const enabled = listEnabledModules(resolveModules(config, repoRoot));
    expect(enabled.length).toBeGreaterThan(0);
    expect(enabled.map((m) => m.id)).toEqual(
      expect.arrayContaining([
        "pocket-dimension",
        "shared-utils",
        "shared-db",
        "shared-auth",
        "watchlist",
        "heimdall",
        "zeo",
        "chhan-chhan",
      ]),
    );
  });

  it("loadDashboard all-scope smoke does not throw (Soft-empty OK)", async () => {
    const mod = await import(path.join(repoRoot, "heimdall.config.mjs"));
    const config = defineConfig(mod.default);
    const snap = loadDashboard(repoRoot, config);
    expect(snap).toBeDefined();
    expect(Array.isArray(snap.epics)).toBe(true);
    expect(Array.isArray(snap.features)).toBe(true);
    expect(Array.isArray(snap.stories)).toBe(true);
  });
});
