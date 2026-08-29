import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("heimdall Sample Mode non-goal (T4 AD-18)", () => {
  it("does not add a Sample/Data SPA page under src/pages", () => {
    const files = readdirSync(path.join(pkgRoot, "src/pages"));
    expect(files.some((f) => /^(Data|Sample)/i.test(f))).toBe(false);
  });

  it("packages dogfood config keeps links.sample null", async () => {
    const configPath = path.resolve(pkgRoot, "../../heimdall.config.mjs");
    const mod = await import(configPath);
    expect(mod.default.links?.sample ?? null).toBeNull();
  });
});
