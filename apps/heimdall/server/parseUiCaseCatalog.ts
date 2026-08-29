import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { UiCaseCatalog, UiScreenManifestSummary, UiTestCase } from "../src/types/dashboard.js";

export const UI_EXPECTATIONS_REL_DIR = "docs/validation/ui-expectations";

type UiScreenManifest = UiScreenManifestSummary & {
  featureIds?: string[];
  personas?: string[];
  tabs?: string[];
  subTabs?: string[];
  toolbar?: string[];
  columns?: string[];
  cases?: UiTestCase[];
  [key: string]: unknown;
};

function resolveRepoPath(repoRoot: string, configuredPath: string): string {
  return path.isAbsolute(configuredPath) ? configuredPath : path.join(repoRoot, configuredPath);
}

function emptyCatalog(rootRelative: string): UiCaseCatalog {
  return {
    source: "docs",
    rootRelative,
    manifests: {},
    cases: [],
    summary: { screenCount: 0, caseCount: 0, byStatus: {}, byPriority: {} },
    generatedAt: new Date().toISOString(),
  };
}

export function loadUiCaseCatalog(repoRoot: string, uiExpectationsDir = UI_EXPECTATIONS_REL_DIR): UiCaseCatalog {
  const dir = resolveRepoPath(repoRoot, uiExpectationsDir);
  const rootRelative = path.isAbsolute(uiExpectationsDir)
    ? path.relative(repoRoot, uiExpectationsDir).replace(/\\/g, "/")
    : uiExpectationsDir.replace(/\\/g, "/");
  const manifests: Record<string, UiScreenManifest> = {};
  const cases: UiTestCase[] = [];

  if (!existsSync(dir)) {
    return emptyCatalog(rootRelative);
  }

  let files: string[];
  try {
    files = readdirSync(dir)
      .filter((f) => /^SCR-\d{2}\.json$/.test(f))
      .sort();
  } catch {
    return emptyCatalog(rootRelative);
  }

  for (const file of files) {
    try {
      const raw = JSON.parse(readFileSync(path.join(dir, file), "utf-8")) as UiScreenManifest;
      if (!raw.screenId) continue;
      manifests[raw.screenId] = raw;
      for (const c of raw.cases ?? []) {
        cases.push(c);
      }
    } catch {
      continue;
    }
  }

  cases.sort((a, b) => a.id.localeCompare(b.id));

  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  for (const c of cases) {
    const st = c.status ?? "defined";
    byStatus[st] = (byStatus[st] ?? 0) + 1;
    byPriority[c.priority] = (byPriority[c.priority] ?? 0) + 1;
  }

  return {
    source: "docs",
    rootRelative,
    manifests,
    cases,
    summary: {
      screenCount: Object.keys(manifests).length,
      caseCount: cases.length,
      byStatus,
      byPriority,
    },
    generatedAt: new Date().toISOString(),
  };
}

/** Write-friendly static catalog for hosted docs / HTTP fetch (no generatedAt churn in git). */
export function toStaticCatalogJson(catalog: UiCaseCatalog): Omit<UiCaseCatalog, "generatedAt"> & {
  generatedAt?: string;
} {
  return {
    source: catalog.source,
    rootRelative: catalog.rootRelative,
    manifests: catalog.manifests,
    cases: catalog.cases,
    summary: catalog.summary,
  };
}
