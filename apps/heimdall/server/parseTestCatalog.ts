import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { ConfigTestLevel } from "../src/config/testLevels.js";
import { isConfigTestLevelEnabled } from "../src/config/testLevels.js";
import type { TestCaseRecord, TestCatalog, TestFileRecord, TestLevel } from "./types.js";

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "coverage", ".turbo"]);

function resolveRepoPath(repoRoot: string, configuredPath: string): string {
  return path.isAbsolute(configuredPath) ? configuredPath : path.join(repoRoot, configuredPath);
}

function walkTests(dir: string, repoRoot: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walkTests(full, repoRoot, out);
      continue;
    }
    if (entry.endsWith(".test.ts")) {
      out.push(path.relative(repoRoot, full).replace(/\\/g, "/"));
    }
  }
}

function inferArea(relativePath: string): string {
  if (relativePath.startsWith("tests/l3/")) {
    const file = relativePath.slice("tests/l3/".length).replace(/\.feature\.test\.ts$|\.test\.ts$/, "");
    return `l3/${file || "feature"}`;
  }
  // Generic path heuristics — parent dirs of common app layouts.
  const match = relativePath.match(
    /^(?:src\/app\/(routes|services|repository|models|flows)\/(.+?)\/[^/]+|src\/(shared|plugins)\/(.+?)\/[^/]+|src\/(shared|plugins)\/[^/]+)/
  );
  if (!match) return relativePath.split("/").slice(0, -1).join("/") || "root";
  if (match[1]) return `${match[1]}/${match[2] ?? ""}`.replace(/\/$/, "");
  if (match[3]) return match[4] ? `${match[3]}/${match[4]}`.replace(/\/$/, "") : match[3];
  return relativePath.split("/").slice(0, -1).join("/") || "root";
}

export function inferTestLevel(relativePath: string, content: string): TestLevel {
  if (relativePath.startsWith("tests/l3/") || /\.feature\.test\.ts$/.test(relativePath)) return "L3";
  // L4 = consumer journey suites that *use* Compenly Flows — not unit tests of the flows package.
  if (/flows\.smoke\.test\.ts$/.test(relativePath) || /\.flow\.smoke\.test\.ts$/.test(relativePath) || /(^|\/)tests\/l4\//.test(relativePath)) {
    return "L4";
  }
  // Unit tests of the flows library itself (e.g. fastify/src/flows/*.test.ts) are L1.
  if (/\/src\/flows\//.test(relativePath)) return "L1";
  if (relativePath.includes("/routes/")) return "L2";
  if (/integration\.test\.ts$/.test(relativePath)) return "L2";
  if (content.includes("fastify.inject") || content.includes("injectAsPersona") || content.includes("withRbacTestApp")) {
    return "L2";
  }
  if (relativePath.includes("/models/") || relativePath.includes("/shared/")) return "L1";
  if (relativePath.includes("/repository/")) return "L1";
  if (relativePath.includes("/services/")) return "L1";
  if (relativePath.includes("/plugins/")) return "L2";
  return "L1";
}

export function parseTestCases(content: string): TestCaseRecord[] {
  const cases: TestCaseRecord[] = [];
  const stack: { name: string; indent: number }[] = [];

  for (const line of content.split("\n")) {
    const indent = line.match(/^(\s*)/)?.[1]?.length ?? 0;
    const describeMatch = line.match(/describe(?:\.(?:only|skip))?\(\s*["'`]([^"'`]+)["'`]/);
    const itMatch = line.match(/(?:\bit|\btest)(?:\.(?:only|skip))?\(\s*["'`]([^"'`]+)["'`]/);
    const closeMatch = /^\s*\}\);?\s*$/.test(line);

    if (closeMatch) {
      while (stack.length > 0 && stack[stack.length - 1]!.indent >= indent) {
        stack.pop();
      }
    }

    if (describeMatch) {
      while (stack.length > 0 && stack[stack.length - 1]!.indent >= indent) {
        stack.pop();
      }
      stack.push({ name: describeMatch[1]!, indent });
    }

    if (itMatch) {
      cases.push({
        name: itMatch[1]!,
        suitePath: stack.map((s) => s.name),
      });
    }
  }

  return cases;
}

export function parseTestFile(repoRoot: string, relativePath: string): TestFileRecord | null {
  try {
    const content = readFileSync(path.join(repoRoot, relativePath), "utf-8");
    const cases = parseTestCases(content);
    const suiteName = cases[0]?.suitePath[0] ?? relativePath.split("/").pop()?.replace(".test.ts", "") ?? relativePath;

    return {
      path: relativePath,
      area: inferArea(relativePath),
      level: inferTestLevel(relativePath, content),
      suiteName,
      cases,
      caseCount: cases.length,
    };
  } catch {
    return null;
  }
}

export function loadTestCatalog(repoRoot: string, scanRoots: readonly string[] = ["src", "tests"]): TestCatalog {
  const paths: string[] = [];
  for (const root of scanRoots) {
    walkTests(resolveRepoPath(repoRoot, root), repoRoot, paths);
  }
  paths.sort((a, b) => a.localeCompare(b));

  const files = paths.flatMap((p) => {
    const file = parseTestFile(repoRoot, p);
    return file ? [file] : [];
  });
  const byLevel: Record<TestLevel, number> = { L1: 0, L2: 0, L3: 0, L4: 0, tooling: 0 };

  let caseCount = 0;
  for (const file of files) {
    byLevel[file.level] += file.caseCount;
    caseCount += file.caseCount;
  }

  return {
    files,
    summary: {
      fileCount: files.length,
      caseCount,
      byLevel,
    },
    generatedAt: new Date().toISOString(),
  };
}

/** Keep only Vitest files whose level is in the enabled set (ignores L5). */
export function filterTestCatalogByLevels(catalog: TestCatalog, enabled: ReadonlySet<ConfigTestLevel>): TestCatalog {
  const files = catalog.files.filter((f) => isConfigTestLevelEnabled(f.level, enabled));
  const byLevel: Record<TestLevel, number> = { L1: 0, L2: 0, L3: 0, L4: 0, tooling: 0 };
  let caseCount = 0;
  for (const file of files) {
    byLevel[file.level] += file.caseCount;
    caseCount += file.caseCount;
  }
  return {
    ...catalog,
    files,
    summary: {
      fileCount: files.length,
      caseCount,
      byLevel,
    },
  };
}
