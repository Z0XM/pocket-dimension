import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function collectTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectTsFiles(full, out);
    else if (/\.(ts|tsx|mjs|cjs)$/.test(entry.name) && !entry.name.includes(".test.")) {
      out.push(full);
    }
  }
  return out;
}

describe("no APP_BASE_PATH magic constant", () => {
  it("does not hardcode APP_BASE_PATH in package source (examples in comments/docs OK in README only)", () => {
    const roots = ["src", "server", "bin"].map((r) => path.join(pkgRoot, r));
    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of collectTsFiles(root)) {
        const text = readFileSync(file, "utf-8");
        // Allow docs that mention the string only as a forbidden example in comments
        // that explicitly say "never" / "does not" / "not".
        if (!text.includes("APP_BASE_PATH")) continue;
        const lines = text.split("\n").filter((l) => l.includes("APP_BASE_PATH"));
        const bad = lines.filter((l) => {
          const t = l.trim();
          if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) {
            return !/never|does not|not |forbidden|no hardcoded|consumer-chosen|host/i.test(t);
          }
          // String literal used as example value in tests is OK when assigned to basePathFromEnv
          if (/basePathFromEnv:\s*["']APP_BASE_PATH["']/.test(t)) return false;
          if (/["']APP_BASE_PATH["']/.test(t) && /basePathFromEnv|example|consumer/i.test(t)) {
            return false;
          }
          return true;
        });
        if (bad.length) offenders.push(`${path.relative(pkgRoot, file)}: ${bad[0]?.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
