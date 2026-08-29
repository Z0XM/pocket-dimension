import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  TestCatalog,
  TestCaseRecord,
  TestFileRecord,
  VitestCaseRunResult,
  VitestFileRunResult,
  VitestRunOutcome,
  VitestRunSnapshot,
} from "./types.js";

export type TestCaseRecordWithRun = TestCaseRecord & {
  lastRun?: VitestCaseRunResult | null;
};

export type TestFileRecordWithRun = Omit<TestFileRecord, "cases"> & {
  lastRun?: VitestFileRunResult | null;
  cases: TestCaseRecordWithRun[];
};

export type TestCatalogWithRuns = Omit<TestCatalog, "files"> & {
  files: TestFileRecordWithRun[];
  lastRun: VitestRunSnapshot | null;
};

export const VITEST_RUNS_REL_DIR = "docs/validation/reports/vitest-runs";

function resolveRepoPath(repoRoot: string, configuredPath: string): string {
  return path.isAbsolute(configuredPath) ? configuredPath : path.join(repoRoot, configuredPath);
}

function latestPath(repoRoot: string, runsDir = VITEST_RUNS_REL_DIR): string {
  return path.join(resolveRepoPath(repoRoot, runsDir), "latest.json");
}

export function vitestCaseKey(relativePath: string, suitePath: string[], name: string): string {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
  return `${normalized}::${[...suitePath, name].join("::")}`;
}

export function emptyVitestRunSnapshot(): VitestRunSnapshot {
  return {
    schemaVersion: 1,
    runAt: null,
    source: "none",
    summary: { passed: 0, failed: 0, skipped: 0 },
    files: {},
    cases: {},
  };
}

export function loadVitestRunSnapshot(repoRoot: string, runsDir = VITEST_RUNS_REL_DIR): VitestRunSnapshot | null {
  const filePath = latestPath(repoRoot, runsDir);
  if (!existsSync(filePath)) return null;
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf-8")) as VitestRunSnapshot;
    if (raw.schemaVersion !== 1) return null;
    if (!raw.summary || typeof raw.files !== "object" || typeof raw.cases !== "object") return null;
    return raw;
  } catch {
    return null;
  }
}

export function mergeTestCatalogWithRuns(catalog: TestCatalog, snapshot: VitestRunSnapshot | null): TestCatalogWithRuns {
  const hasRun = Boolean(snapshot?.runAt);
  const files = snapshot?.files ?? {};
  const cases = snapshot?.cases ?? {};
  return {
    ...catalog,
    lastRun: hasRun ? snapshot : null,
    files: catalog.files.map((file) => ({
      ...file,
      ...(hasRun ? { lastRun: files[file.path] ?? null } : {}),
      cases: file.cases.map((c) => {
        const key = vitestCaseKey(file.path, c.suitePath, c.name);
        return {
          ...c,
          ...(hasRun ? { lastRun: cases[key] ?? null } : {}),
        };
      }),
    })),
  };
}

function parseOutcome(value: unknown, label: string): VitestRunOutcome {
  if (value === "passed" || value === "failed" || value === "skipped") return value;
  throw new Error(`${label} outcome is invalid`);
}

function parseFileResult(value: unknown, label: string): VitestFileRunResult {
  if (!value || typeof value !== "object") throw new Error(`${label} must be an object`);
  const r = value as Record<string, unknown>;
  if (typeof r.passed !== "number" || typeof r.failed !== "number" || typeof r.skipped !== "number") {
    throw new Error(`${label}.passed/failed/skipped are required numbers`);
  }
  return {
    outcome: parseOutcome(r.outcome, label),
    passed: r.passed,
    failed: r.failed,
    skipped: r.skipped,
    ...(typeof r.durationMs === "number" ? { durationMs: r.durationMs } : {}),
    ...(typeof r.runAt === "string" ? { runAt: r.runAt } : {}),
  };
}

function parseCaseResult(value: unknown, label: string): VitestCaseRunResult {
  if (!value || typeof value !== "object") throw new Error(`${label} must be an object`);
  const r = value as Record<string, unknown>;
  return {
    outcome: parseOutcome(r.outcome, label),
    ...(typeof r.durationMs === "number" ? { durationMs: r.durationMs } : {}),
    ...(typeof r.error === "string" ? { error: r.error } : {}),
  };
}

export function parseVitestRunBody(body: unknown): VitestRunSnapshot {
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
  const summary = raw.summary as VitestRunSnapshot["summary"] | undefined;
  if (!summary || typeof summary.passed !== "number" || typeof summary.failed !== "number" || typeof summary.skipped !== "number") {
    throw new Error("summary.passed/failed/skipped are required numbers");
  }
  if (!raw.files || typeof raw.files !== "object") {
    throw new Error("files object is required");
  }
  if (!raw.cases || typeof raw.cases !== "object") {
    throw new Error("cases object is required");
  }

  const files: Record<string, VitestFileRunResult> = {};
  for (const [filePath, value] of Object.entries(raw.files as Record<string, unknown>)) {
    files[filePath.replace(/\\/g, "/")] = parseFileResult(value, `files.${filePath}`);
  }
  const cases: Record<string, VitestCaseRunResult> = {};
  for (const [key, value] of Object.entries(raw.cases as Record<string, unknown>)) {
    cases[key] = parseCaseResult(value, `cases.${key}`);
  }

  return {
    schemaVersion: 1,
    runAt: raw.runAt as string | null,
    source: raw.source,
    ...(typeof raw.command === "string" ? { command: raw.command } : {}),
    ...(typeof raw.branch === "string" ? { branch: raw.branch } : {}),
    ...(typeof raw.commit === "string" ? { commit: raw.commit } : {}),
    summary: {
      passed: summary.passed,
      failed: summary.failed,
      skipped: summary.skipped,
    },
    files,
    cases,
  };
}

export function mergeVitestRunSnapshots(existing: VitestRunSnapshot | null, incoming: VitestRunSnapshot): VitestRunSnapshot {
  const base = existing ?? emptyVitestRunSnapshot();
  const files = { ...base.files, ...incoming.files };
  const cases = { ...base.cases, ...incoming.cases };

  let passed = 0;
  let failed = 0;
  let skipped = 0;
  for (const result of Object.values(cases)) {
    if (result.outcome === "passed") passed += 1;
    else if (result.outcome === "failed") failed += 1;
    else skipped += 1;
  }
  if (Object.keys(cases).length === 0) {
    for (const file of Object.values(files)) {
      passed += file.passed;
      failed += file.failed;
      skipped += file.skipped;
    }
  }

  return {
    schemaVersion: 1,
    runAt: incoming.runAt ?? base.runAt,
    source: incoming.source || base.source,
    ...((incoming.command ?? base.command) ? { command: incoming.command ?? base.command } : {}),
    ...((incoming.branch ?? base.branch) ? { branch: incoming.branch ?? base.branch } : {}),
    ...((incoming.commit ?? base.commit) ? { commit: incoming.commit ?? base.commit } : {}),
    summary: { passed, failed, skipped },
    files,
    cases,
  };
}

export function writeVitestRunSnapshot(repoRoot: string, snapshot: VitestRunSnapshot, opts?: { alsoDateCopy?: boolean; runsDir?: string }): string {
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

export function mergeAndWriteVitestRunSnapshot(
  repoRoot: string,
  incoming: VitestRunSnapshot,
  opts?: { alsoDateCopy?: boolean; runsDir?: string }
): { path: string; snapshot: VitestRunSnapshot } {
  const merged = mergeVitestRunSnapshots(loadVitestRunSnapshot(repoRoot, opts?.runsDir), incoming);
  const writtenPath = writeVitestRunSnapshot(repoRoot, merged, opts);
  return { path: writtenPath, snapshot: merged };
}
