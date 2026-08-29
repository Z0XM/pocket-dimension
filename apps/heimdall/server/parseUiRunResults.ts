import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { UiCaseCatalog, UiCaseRunResult, UiRunSnapshot, UiTestCase } from "../src/types/dashboard.js";

export type UiTestCaseWithRun = UiTestCase & {
  lastRun?: UiCaseRunResult | null;
};

export type UiCaseCatalogWithRuns = Omit<UiCaseCatalog, "cases"> & {
  cases: UiTestCaseWithRun[];
  lastRun: UiRunSnapshot | null;
};

export const UI_RUNS_REL_DIR = "docs/validation/reports/ui-runs";

function resolveRepoPath(repoRoot: string, configuredPath: string): string {
  return path.isAbsolute(configuredPath) ? configuredPath : path.join(repoRoot, configuredPath);
}

function latestPath(repoRoot: string, runsDir = UI_RUNS_REL_DIR): string {
  return path.join(resolveRepoPath(repoRoot, runsDir), "latest.json");
}

export function emptyUiRunSnapshot(): UiRunSnapshot {
  return {
    schemaVersion: 1,
    runAt: null,
    source: "none",
    summary: { passed: 0, failed: 0, skipped: 0, timedOut: 0 },
    results: {},
  };
}

export function loadUiRunSnapshot(repoRoot: string, runsDir = UI_RUNS_REL_DIR): UiRunSnapshot | null {
  const filePath = latestPath(repoRoot, runsDir);
  if (!existsSync(filePath)) return null;
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf-8")) as UiRunSnapshot;
    if (raw.schemaVersion !== 1) return null;
    if (!raw.summary || typeof raw.results !== "object") return null;
    return raw;
  } catch {
    return null;
  }
}

export function mergeCatalogWithRuns(catalog: UiCaseCatalog, snapshot: UiRunSnapshot | null): UiCaseCatalogWithRuns {
  const hasRun = Boolean(snapshot?.runAt);
  const results = snapshot?.results ?? {};
  return {
    ...catalog,
    lastRun: hasRun ? snapshot : null,
    cases: catalog.cases.map((c) => ({
      ...c,
      ...(hasRun ? { lastRun: results[c.id] ?? null } : {}),
    })),
  };
}

export function loadUiCaseCatalogWithRuns(repoRoot: string, catalog: UiCaseCatalog, runsDir = UI_RUNS_REL_DIR): UiCaseCatalogWithRuns {
  return mergeCatalogWithRuns(catalog, loadUiRunSnapshot(repoRoot, runsDir));
}

export function parseUiRunBody(body: unknown): UiRunSnapshot {
  if (!body || typeof body !== "object") {
    throw new Error("Body must be a JSON object");
  }
  const raw = body as Record<string, unknown>;
  if (raw.schemaVersion !== 1) {
    throw new Error("schemaVersion must be 1");
  }
  if (raw.runAt !== null && typeof raw.runAt !== "string") {
    throw new Error("runAt must be an ISO string or null");
  }
  if (typeof raw.source !== "string" || !raw.source) {
    throw new Error("source is required");
  }
  const summary = raw.summary as UiRunSnapshot["summary"] | undefined;
  if (!summary || typeof summary.passed !== "number" || typeof summary.failed !== "number" || typeof summary.skipped !== "number") {
    throw new Error("summary.passed/failed/skipped are required numbers");
  }
  if (!raw.results || typeof raw.results !== "object") {
    throw new Error("results object is required");
  }
  const results: Record<string, UiCaseRunResult> = {};
  for (const [id, value] of Object.entries(raw.results as Record<string, unknown>)) {
    if (!value || typeof value !== "object") {
      throw new Error(`results.${id} must be an object`);
    }
    const r = value as Record<string, unknown>;
    const outcome = r.outcome;
    if (outcome !== "passed" && outcome !== "failed" && outcome !== "skipped" && outcome !== "timedOut") {
      throw new Error(`results.${id}.outcome is invalid`);
    }
    results[id] = {
      outcome,
      ...(typeof r.durationMs === "number" ? { durationMs: r.durationMs } : {}),
      ...(typeof r.reason === "string" ? { reason: r.reason } : {}),
      ...(typeof r.error === "string" ? { error: r.error } : {}),
    };
  }
  return {
    schemaVersion: 1,
    runAt: raw.runAt as string | null,
    source: raw.source,
    ...(typeof raw.command === "string" ? { command: raw.command } : {}),
    ...(typeof raw.branch === "string" ? { branch: raw.branch } : {}),
    ...(typeof raw.commit === "string" ? { commit: raw.commit } : {}),
    ...(typeof raw.demoUrl === "string" ? { demoUrl: raw.demoUrl } : {}),
    summary: {
      passed: summary.passed,
      failed: summary.failed,
      skipped: summary.skipped,
      ...(typeof summary.timedOut === "number" ? { timedOut: summary.timedOut } : {}),
    },
    results,
  };
}

function summarizeUiResults(results: Record<string, UiCaseRunResult>): UiRunSnapshot["summary"] {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let timedOut = 0;
  for (const result of Object.values(results)) {
    if (result.outcome === "passed") passed += 1;
    else if (result.outcome === "failed") failed += 1;
    else if (result.outcome === "timedOut") timedOut += 1;
    else skipped += 1;
  }
  return {
    passed,
    failed,
    skipped,
    ...(timedOut > 0 ? { timedOut } : {}),
  };
}

export function mergeUiRunSnapshots(existing: UiRunSnapshot | null, incoming: UiRunSnapshot): UiRunSnapshot {
  const base = existing ?? emptyUiRunSnapshot();
  const results = { ...base.results, ...incoming.results };

  return {
    schemaVersion: 1,
    runAt: incoming.runAt ?? base.runAt,
    source: incoming.source || base.source,
    ...((incoming.command ?? base.command) ? { command: incoming.command ?? base.command } : {}),
    ...((incoming.branch ?? base.branch) ? { branch: incoming.branch ?? base.branch } : {}),
    ...((incoming.commit ?? base.commit) ? { commit: incoming.commit ?? base.commit } : {}),
    ...((incoming.demoUrl ?? base.demoUrl) ? { demoUrl: incoming.demoUrl ?? base.demoUrl } : {}),
    summary: summarizeUiResults(results),
    results,
  };
}

export function writeUiRunSnapshot(repoRoot: string, snapshot: UiRunSnapshot, opts?: { alsoDateCopy?: boolean; runsDir?: string }): string {
  const filePath = latestPath(repoRoot, opts?.runsDir);
  mkdirSync(path.dirname(filePath), { recursive: true });
  const json = `${JSON.stringify(snapshot, null, 2)}\n`;
  writeFileSync(filePath, json, "utf-8");
  if (opts?.alsoDateCopy && snapshot.runAt) {
    const day = snapshot.runAt.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      writeFileSync(path.join(path.dirname(filePath), `${day}.json`), json, "utf-8");
    }
  }
  return filePath;
}

export function mergeAndWriteUiRunSnapshot(
  repoRoot: string,
  incoming: UiRunSnapshot,
  opts?: { alsoDateCopy?: boolean; runsDir?: string; existing?: UiRunSnapshot | null }
): { path: string; snapshot: UiRunSnapshot } {
  const base = opts?.existing !== undefined ? opts.existing : loadUiRunSnapshot(repoRoot, opts?.runsDir);
  const merged = mergeUiRunSnapshots(base, incoming);
  const writtenPath = writeUiRunSnapshot(repoRoot, merged, opts);
  return { path: writtenPath, snapshot: merged };
}
